import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  cookieBase,
} from "@/lib/config";
import { refreshSession } from "@/lib/refresh";

// Runs before every dashboard request. Its jobs:
//   1. no session at all            -> send the visitor to /login
//   2. access cookie still present  -> nothing to do
//   3. access cookie expired, refresh cookie present -> refresh once, then continue
// Server components can't set cookies, which is why the refresh lives here.
//
// This is a convenience, not the security boundary: every server component and server action
// re-checks the session through the data layer (lib/graphql.ts, lib/dal.ts).
export async function proxy(request: NextRequest) {
  if (request.cookies.get(ACCESS_COOKIE)?.value) return NextResponse.next();

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return toLogin(request, false);

  const result = await refreshSession(refreshToken);

  // Backend unreachable: don't log anyone out for that. Carry on without a token; the page
  // shows an error with a Retry button (see lib/graphql.ts).
  if (result.kind === "unavailable") return NextResponse.next();
  if (result.kind === "rejected") return toLogin(request, true);

  // Update the request's cookies so the server components rendering THIS request already see
  // the new token, and the response so the browser stores it for the next request.
  request.cookies.set(ACCESS_COOKIE, result.accessToken);
  request.cookies.set(REFRESH_COOKIE, result.refreshToken);
  const response = NextResponse.next({ request });
  response.cookies.set(ACCESS_COOKIE, result.accessToken, { ...cookieBase, maxAge: ACCESS_MAX_AGE });
  response.cookies.set(REFRESH_COOKIE, result.refreshToken, { ...cookieBase, maxAge: REFRESH_MAX_AGE });
  return response;
}

function toLogin(request: NextRequest, expired: boolean) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = expired ? "?reason=expired" : "";
  const response = NextResponse.redirect(url);
  if (expired) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }
  return response;
}

export const config = {
  // Everything except static assets, the login page and the cookie-clearing route.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|auth|.*\\..*).*)"],
};
