// Constants shared by the proxy, server actions and server components.
// No imports from next/headers here: the proxy can't use them.

export const BACKEND_URL = process.env.BACKEND_GRAPHQL_URL ?? "http://localhost:4000/graphql";

// Two httpOnly cookies hold the session. JavaScript in the browser can read neither, so an XSS
// bug can't steal the tokens (that is the whole reason for not using localStorage).
export const ACCESS_COOKIE = "of_at";
export const REFRESH_COOKIE = "of_rt";

// The access JWT lives 15 minutes on the server; the cookie expires a minute earlier so we never
// send a token that dies in flight. A missing access cookie is the signal "refresh now".
export const ACCESS_MAX_AGE = 14 * 60;
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // Secure cookies need https. Production builds default to Secure; override with COOKIE_SECURE.
  secure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",
};
