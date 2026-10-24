import { backendRequest, BackendError } from "./backend";
import { REFRESH_TOKENS, type RefreshData } from "./queries";

export type RefreshResult =
  | { kind: "ok"; accessToken: string; refreshToken: string }
  | { kind: "rejected" } // the backend said the refresh token is invalid, expired or already used
  | { kind: "unavailable" }; // backend unreachable: keep the session, try again later

// Refresh tokens are single-use on the server. If two requests that both carry the same expired
// session each call refreshTokens, the second looks like token theft and the backend revokes
// the employee's whole session. A page load fires several requests at once (prefetches, RSC
// fetches, server actions), so refreshing has to be single-flight: everyone holding the same
// old refresh token awaits ONE call and gets the same new pair.
//
// A successful (or definitively rejected) result is kept for a few seconds, because a request
// that was already in flight when the cookies were rotated still carries the old token and must
// not trigger a second refresh. An "unavailable" result is NOT kept: nothing was spent on the
// backend, so remembering the outage would make "Try again" keep failing after it recovers.
//
// Limit (see DECISIONS.md): this map lives in one server process. Several instances (serverless,
// a load balancer) would each refresh separately; the production fix is a short reuse grace
// window on the backend, or a lock in Redis.
const flights = new Map<string, Promise<RefreshResult>>();
const KEEP_RESULT_MS = 10_000;

export function refreshSession(refreshToken: string): Promise<RefreshResult> {
  const existing = flights.get(refreshToken);
  if (existing) return existing;

  const flight = doRefresh(refreshToken);
  flights.set(refreshToken, flight);
  void flight.then((result) => {
    if (result.kind === "unavailable") {
      flights.delete(refreshToken); // callers already waiting still share this one result
    } else {
      setTimeout(() => flights.delete(refreshToken), KEEP_RESULT_MS).unref?.();
    }
  });
  return flight;
}

async function doRefresh(refreshToken: string): Promise<RefreshResult> {
  try {
    const data = await backendRequest<RefreshData>(REFRESH_TOKENS, { refreshToken });
    return { kind: "ok", ...data.refreshTokens };
  } catch (e) {
    if (e instanceof BackendError && e.kind === "graphql") return { kind: "rejected" };
    return { kind: "unavailable" };
  }
}
