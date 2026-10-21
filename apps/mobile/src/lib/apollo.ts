import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  HttpLink,
  InMemoryCache,
  ServerError,
} from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { from, switchMap, throwError } from "rxjs";
import { tokens } from "@/lib/storage";
import { useAuth } from "@/stores/auth";

// Physical phone: use your laptop's LAN IP, never localhost. Android emulator would be 10.0.2.2.
const API_URL = process.env.EXPO_PUBLIC_API_URL!;

const httpLink = new HttpLink({ uri: API_URL });

const authLink = new SetContextLink(({ headers }) => ({
  headers: {
    ...headers,
    ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
  },
}));

const REFRESH_QUERY = `mutation Refresh($refreshToken: String!) {
  refreshTokens(refreshToken: $refreshToken) { accessToken refreshToken }
}`;

// Single-flight: refresh tokens rotate, so concurrent 401s must share ONE refresh call.
let refreshing: Promise<boolean> | null = null;
function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const current = tokens.refresh;
      if (!current) return false;
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: REFRESH_QUERY,
          variables: { refreshToken: current },
        }),
      }).then((r) => r.json());
      const t = res?.data?.refreshTokens;
      if (!t) return false;
      tokens.set(t.accessToken, t.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

const isUnauth = (error: unknown) =>
  (CombinedGraphQLErrors.is(error) &&
    error.errors.some((e) => e.extensions?.code === "UNAUTHENTICATED")) ||
  (ServerError.is(error) && error.statusCode === 401);

const errorLink = new ErrorLink(({ error, operation, forward }) => {
  // No refresh token (e.g. a failed login attempt): let the original error through.
  if (!isUnauth(error) || !tokens.refresh) return;
  return from(refresh()).pipe(
    switchMap((ok) => {
      if (!ok) {
        useAuth.getState().signOut();
        void client.clearStore();
        return throwError(() => error);
      }
      return forward(operation); // authLink re-runs and picks up the new token
    }),
  );
});

export const client = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});
