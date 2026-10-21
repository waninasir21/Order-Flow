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
