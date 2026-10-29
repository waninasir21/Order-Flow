import type { Request } from "express";
import { requireAuth, requireRole } from "../../src/auth/guards";
import { buildContext, buildWsContext } from "../../src/context";
import { signAccessToken } from "../../src/auth/tokens";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { extensions?: { code?: string } }).extensions?.code;
  }
  return undefined;
};

describe("guards", () => {
  it("requireAuth throws UNAUTHENTICATED for anonymous callers", () => {
    expect(code(() => requireAuth({ auth: null }))).toBe("UNAUTHENTICATED");
  });

  it("requireAuth returns the payload for logged-in callers", () => {
    expect(requireAuth({ auth: { employeeId: "e", role: "REP" } })).toEqual({
      employeeId: "e",
      role: "REP",
    });
  });

  it("requireRole distinguishes 'not logged in' from 'not allowed'", () => {
    expect(code(() => requireRole({ auth: null }, "ADMIN"))).toBe("UNAUTHENTICATED");
    expect(code(() => requireRole({ auth: { employeeId: "e", role: "REP" } }, "ADMIN"))).toBe("FORBIDDEN");
    expect(code(() => requireRole({ auth: { employeeId: "e", role: "ADMIN" } }, "ADMIN"))).toBeUndefined();
  });
});

describe("context builders", () => {
  const token = signAccessToken({ employeeId: "emp_9", role: "REP" });
  const req = (authorization?: string) => ({ headers: { authorization } }) as unknown as Request;

  it("reads a Bearer token from the Authorization header", () => {
    expect(buildContext(req(`Bearer ${token}`)).auth).toMatchObject({ employeeId: "emp_9" });
  });

  it("treats a missing header, wrong scheme, or bad token as anonymous", () => {
    expect(buildContext(req()).auth).toBeNull();
    expect(buildContext(req(`Basic ${token}`)).auth).toBeNull();
    expect(buildContext(req("Bearer not-a-jwt")).auth).toBeNull();
  });

  it("authenticates WebSocket connections from connectionParams.accessToken", () => {
    expect(buildWsContext(token).auth).toMatchObject({ employeeId: "emp_9" });
    expect(buildWsContext(undefined).auth).toBeNull();
    expect(buildWsContext(12345).auth).toBeNull();
    expect(buildWsContext("garbage").auth).toBeNull();
  });
});
