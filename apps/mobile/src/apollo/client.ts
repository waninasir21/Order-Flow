import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  Observable,
  from,
  split,
} from "@apollo/client";
import type { FetchResult } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";
import { API_URL } from "@/config";
import { REFRESH_TOKENS_DOCUMENT } from "@/graphql/operations";
import { useAuthStore } from "@/stores/auth";

const httpLink = new HttpLink({ uri: API_URL });

// Reads the token from the store on every request, so a refreshed token is
// picked up automatically (including when the error link retries an operation).
const authLink = setContext((_, { headers }) => {
  const token = useAuthStore.getState().accessToken;
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// Refresh tokens are single-use on the server, so two parallel refreshes would
// make the second one look like token theft and log the user out everywhere.
// Single-flight: every caller that hits an expired token awaits the same promise.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) {
    clear();
    return false;
  }
  try {
    // Plain fetch (not Apollo) so this request can't recurse into the error link.
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: REFRESH_TOKENS_DOCUMENT,
        variables: { refreshToken },
      }),
    });
    const json = (await res.json()) as {
      data?: {
        refreshTokens?: { accessToken: string; refreshToken: string };
      } | null;
    };
    const tokens = json.data?.refreshTokens;
    if (!tokens) {
      // Server said no (expired, revoked or reused): the session is really over.
      clear();
      return false;
    }
    setTokens(tokens.accessToken, tokens.refreshToken);
    return true;
  } catch {
    // Network failure: keep the session, the user may just be offline.
    return false;
  }
}

const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  const unauthenticated = graphQLErrors?.some(
    (e) => e.extensions?.code === "UNAUTHENTICATED",
  );
  // Login failures are also UNAUTHENTICATED ("wrong password"); never refresh for those.
  if (!unauthenticated || operation.operationName === "Login") return;
  // Retry each operation at most once.
  if (operation.getContext().retried) return;

  return new Observable<FetchResult>((observer) => {
    let subscription: { unsubscribe: () => void } | undefined;
    refreshSession().then(() => {
      operation.setContext({ retried: true });
      subscription = forward(operation).subscribe({
        next: (value) => observer.next(value),
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });
    });
    return () => subscription?.unsubscribe();
  });
});

// ---- Subscriptions (WebSocket) -------------------------------------------------------
// Same server, same path, ws:// instead of http://.
const WS_URL = API_URL.replace(/^http/, "ws");

// Seconds before expiry at which we treat the access token as already expired.
const EXPIRY_MARGIN_S = 30;

function accessTokenExpiresSoon(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json) as { exp?: number };
    return (
      typeof exp !== "number" ||
      exp * 1000 - Date.now() < EXPIRY_MARGIN_S * 1000
    );
  } catch {
    return true;
  }
}

// A socket authenticates once, when it connects (browsers and React Native can't set headers
// on a WebSocket, so the token travels in connectionParams). The server closes the socket
// when the token expires; graphql-ws then reconnects and calls this again, so a stale token
// is refreshed BEFORE it is sent. Without this, every reconnect after 15 minutes would fail.
async function wsConnectionParams() {
  const token = useAuthStore.getState().accessToken;
  if (!token || accessTokenExpiresSoon(token)) await refreshSession();
  return { accessToken: useAuthStore.getState().accessToken };
}

const wsClient = createClient({
  url: WS_URL,
  // Connect when the first subscription starts, disconnect when the last one stops. The
  // LiveUpdates component only runs while signed in, so logging out closes the socket.
  lazy: true,
  connectionParams: wsConnectionParams,
  // Phones lose signal all the time: keep retrying, forever, with a capped backoff.
  retryAttempts: Infinity,
  retryWait: (retries) =>
    new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(300 * 2 ** retries, 15_000) + Math.random() * 500,
      ),
    ),
});

// Events published while the socket was down are gone for good (the server keeps no backlog),
// so every (re)connection ends with a plain refetch of the orders list to catch up.
wsClient.on("connected", () => {
  // Only if the Orders screen's query is alive right now. Asking for a query that isn't
  // active makes Apollo warn; and if it isn't active nothing is stale, because the screen
  // fetches fresh data (cache-and-network) the next time it opens.
  const ordersActive = [
    ...apolloClient.getObservableQueries("active").values(),
  ].some((q) => q.queryName === "Orders");
  if (ordersActive)
    void apolloClient
      .refetchQueries({ include: ["Orders"] })
      .catch(() => undefined);
});

const wsLink = new GraphQLWsLink(wsClient);

// Subscriptions go over the socket; queries and mutations stay on HTTP.
const transportLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return (
      def.kind === "OperationDefinition" && def.operation === "subscription"
    );
  },
  wsLink,
  from([errorLink, authLink, httpLink]),
);

export const apolloClient = new ApolloClient({
  link: transportLink,
  cache: new InMemoryCache(),
});

// Whenever the session ends (logout or failed refresh), drop all cached data so the
// next person to log in on this phone never sees the previous user's orders.
useAuthStore.subscribe((state, prev) => {
  if (prev.refreshToken && !state.refreshToken) {
    void apolloClient.clearStore();
  }
});
