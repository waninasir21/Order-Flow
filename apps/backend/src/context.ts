import type { Request } from "express";
import { verifyAccessToken, type AccessPayload } from "./auth/tokens";

export interface Context {
  // null = anonymous (no/invalid/expired token). Resolvers decide whether that is allowed.
  auth: AccessPayload | null;
}

export function buildContext(req: Request): Context {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return { auth: verifyAccessToken(header.slice("Bearer ".length).trim()) };
  }
  return { auth: null };
}

// WebSocket connections authenticate once, at connection time, via connectionParams
// (browsers and RN can't set headers on a WebSocket). The expiry is enforced separately
// by the server (see index.ts), which closes the socket when the token expires.
export function buildWsContext(accessToken: unknown): Context {
  return { auth: typeof accessToken === "string" ? verifyAccessToken(accessToken) : null };
}
