import bcrypt from "bcryptjs";
import type { Employee } from "@prisma/client";
import { prisma } from "../prisma";
import { config } from "../config";
import { requireAuth } from "../auth/guards";
import { generateRefreshToken, hashToken, signAccessToken } from "../auth/tokens";
import { unauthenticated } from "../errors";
import type { Context } from "../context";

// Compared against when the phone number is unknown, so "no such user" and
// "wrong password" take about the same time (avoids leaking which phones exist).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

async function issueAuthPayload(employee: Employee) {
  const accessToken = signAccessToken({ employeeId: employee.id, role: employee.role });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      employeeId: employee.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken, employee };
}

export const authQueries = {
  me: async (_: unknown, __: unknown, ctx: Context) => {
    const auth = requireAuth(ctx);
    const employee = await prisma.employee.findUnique({ where: { id: auth.employeeId } });
    if (!employee) throw unauthenticated("Account no longer exists. Please log in again.");
    return employee;
  },
};

export const authMutations = {
  login: async (_: unknown, args: { phone: string; password: string }) => {
    const employee = await prisma.employee.findUnique({ where: { phone: args.phone } });
    const passwordOk = await bcrypt.compare(args.password, employee?.passwordHash ?? DUMMY_HASH);
    if (!employee || !passwordOk) {
      throw unauthenticated("Invalid phone or password");
    }
    return issueAuthPayload(employee);
  },

  // Rotation: every refresh token works exactly once. Using a spent token means it
  // was probably stolen, so all of that employee's sessions are revoked.
  refreshTokens: async (_: unknown, args: { refreshToken: string }) => {
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(args.refreshToken) },
      include: { employee: true },
    });
    if (!record) throw unauthenticated("Invalid refresh token");
    if (record.expiresAt.getTime() < Date.now()) throw unauthenticated("Refresh token expired");

    // Atomic "spend": only one concurrent request can flip revokedAt from null.
    const spent = await prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (spent.count === 0) {
      await prisma.refreshToken.updateMany({
        where: { employeeId: record.employeeId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw unauthenticated("Refresh token was already used. Please log in again.");
    }
    return issueAuthPayload(record.employee);
  },

  logout: async (_: unknown, args: { refreshToken: string }) => {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(args.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return true;
  },
};
