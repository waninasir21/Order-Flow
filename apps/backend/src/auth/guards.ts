import type { Role } from "@prisma/client";
import type { Context } from "../context";
import { forbidden, unauthenticated } from "../errors";
import type { AccessPayload } from "./tokens";

export function requireAuth(ctx: Context): AccessPayload {
  if (!ctx.auth) {
    throw unauthenticated("You must be logged in");
  }
  return ctx.auth;
}

export function requireRole(ctx: Context, role: Role): AccessPayload {
  const auth = requireAuth(ctx);
  if (auth.role !== role) {
    throw forbidden(`This action requires the ${role} role`);
  }
  return auth;
}
