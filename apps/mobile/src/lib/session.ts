import { apolloClient } from "@/apollo/client";
import { LOGOUT } from "@/graphql/operations";
import { useAuthStore } from "@/stores/auth";

// Best-effort server revoke, then clear locally. Clearing the store also wipes the
// Apollo cache (see the subscription in apollo/client.ts) and the route guard
// sends the user back to the login screen.
export async function signOut(): Promise<void> {
  const { refreshToken, clear } = useAuthStore.getState();
  if (refreshToken) {
    try {
      await apolloClient.mutate({ mutation: LOGOUT, variables: { refreshToken } });
    } catch {
      // Offline or already expired: still log out locally.
    }
  }
  clear();
}
