import "server-only";
import { redirect } from "next/navigation";
import { BackendError, backendRequest } from "./backend";
import { readSession } from "./session";

// The dashboard's data access: server components call this, never the browser. It attaches
// the access token from the httpOnly cookie, so the token never reaches client-side JavaScript.
//
// Errors:
//   - not signed in, or the backend rejects the token  -> redirect (the session is over)
//   - backend unreachable                              -> throws; the error boundary shows Retry
//   - anything else (NOT_FOUND, FORBIDDEN, ...)        -> throws BackendError for the caller
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { accessToken, refreshToken } = await readSession();

  if (!accessToken) {
    // A refresh cookie without an access cookie means the proxy couldn't refresh because the
    // backend was unreachable. That is an outage, not a logout.
    if (refreshToken) throw new BackendError("The backend could not be reached", "network");
    redirect("/login");
  }

  try {
    return await backendRequest<T>(query, variables, accessToken);
  } catch (e) {
    // The backend refused the token (revoked, signed with another secret, account deleted...).
    // /auth/expired clears the stale cookies, then lands on /login.
    if (e instanceof BackendError && e.kind === "graphql" && e.code === "UNAUTHENTICATED") {
      redirect("/auth/expired");
    }
    throw e;
  }
}
