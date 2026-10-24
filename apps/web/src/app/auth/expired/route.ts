import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/config";

// Server components can't delete cookies, but route handlers can. Pages send the visitor here
// when the session is unusable (rejected token, or a non-admin account); this clears the
// stale cookies and lands on /login with an explanation.
export function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get("reason") === "forbidden" ? "forbidden" : "expired";
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?reason=${reason}`;
  const response = NextResponse.redirect(url);
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
