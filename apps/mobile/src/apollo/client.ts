import { ApolloClient, HttpLink, InMemoryCache, Observable, from } from "@apollo/client";
import type { FetchResult } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { API_URL } from "@/config";
import { REFRESH_TOKENS_DOCUMENT } from "@/graphql/operations";
import { useAuthStore } from "@/stores/auth";

const httpLink = new HttpLink({ uri: API_URL });

// Reads the token from the store on every request, so a refreshed token is
// picked up automatically (including when the error link retries an operation).
const authLink = setContext((_, { headers }) => {
  const token = useAuthStore.getState().accessToken;
  return { headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) } };
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
      data?: { refreshTokens?: { accessToken: string; refreshToken: string } } | null;
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
  const unauthenticated = graphQLErrors?.some((e) => e.extensions?.code === "UNAUTHENTICATED");
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

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});

// Whenever the session ends (logout or failed refresh), drop all cached data so the
// next person to log in on this phone never sees the previous user's orders.
useAuthStore.subscribe((state, prev) => {
  if (prev.refreshToken && !state.refreshToken) {
    void apolloClient.clearStore();
  }
});
