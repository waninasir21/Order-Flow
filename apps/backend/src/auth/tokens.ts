import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { config } from "../config";

export interface AccessPayload {
  employeeId: string;
  role: Role;
  // Seconds since epoch; set when a token is verified (not when signing). Long-lived
  // WebSocket connections use it to close themselves when the token expires.
  exp?: number;
}

export function signAccessToken({ employeeId, role }: AccessPayload): string {
  return jwt.sign({ employeeId, role }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.accessTokenTtlSeconds,
  });
}

// Returns null for anything invalid or expired; callers treat null as "not logged in".
export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    if (typeof decoded === "string") return null;
    const { employeeId, role, exp } = decoded as {
      employeeId?: unknown;
      role?: unknown;
      exp?: unknown;
    };
    if (typeof employeeId !== "string") return null;
    if (role !== "REP" && role !== "ADMIN") return null;
    return { employeeId, role, exp: typeof exp === "number" ? exp : undefined };
  } catch {
    return null;
  }
}

// Refresh tokens are opaque random strings, not JWTs: the server looks them up by hash.
export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
