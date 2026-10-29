import { prisma } from "../../src/prisma";
import { hashToken, verifyAccessToken } from "../../src/auth/tokens";
import { asAuth, createEmployee, PASSWORD } from "../helpers/db";
import { errorCode, run } from "../helpers/gql";

const LOGIN = /* GraphQL */ `
  mutation ($phone: String!, $password: String!) {
    login(phone: $phone, password: $password) {
      accessToken
      refreshToken
      employee { id name role }
    }
  }
`;
const REFRESH = /* GraphQL */ `
  mutation ($refreshToken: String!) {
    refreshTokens(refreshToken: $refreshToken) { accessToken refreshToken }
  }
`;
const LOGOUT = /* GraphQL */ `mutation ($refreshToken: String!) { logout(refreshToken: $refreshToken) }`;

type LoginData = { login: { accessToken: string; refreshToken: string; employee: { id: string; role: string } } };
type RefreshData = { refreshTokens: { accessToken: string; refreshToken: string } };

async function login(phone: string, password = PASSWORD) {
  const res = await run<LoginData>(LOGIN, { phone, password });
  if (res.errors || !res.data) throw new Error(`login failed: ${res.errors?.[0]?.message}`);
  return res.data.login;
}

describe("login", () => {
  it("returns a valid access token, a refresh token and the employee", async () => {
    const emp = await createEmployee({ role: "ADMIN" });
    const payload = await login(emp.phone);
    expect(payload.employee).toMatchObject({ id: emp.id, role: "ADMIN" });
    expect(verifyAccessToken(payload.accessToken)).toMatchObject({ employeeId: emp.id, role: "ADMIN" });
  });

  it("stores only the hash of the refresh token", async () => {
    const emp = await createEmployee();
    const { refreshToken } = await login(emp.phone);
    const rows = await prisma.refreshToken.findMany({ where: { employeeId: emp.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashToken(refreshToken));
    expect(rows[0]?.tokenHash).not.toBe(refreshToken);
    expect(rows[0]?.revokedAt).toBeNull();
  });

  it("rejects a wrong password and an unknown phone with the same message", async () => {
    const emp = await createEmployee();
    const wrongPw = await run(LOGIN, { phone: emp.phone, password: "nope" });
    const unknown = await run(LOGIN, { phone: "+910000000000", password: PASSWORD });
    expect(errorCode(wrongPw)).toBe("UNAUTHENTICATED");
    expect(errorCode(unknown)).toBe("UNAUTHENTICATED");
    expect(wrongPw.errors?.[0]?.message).toBe(unknown.errors?.[0]?.message);
    expect(await prisma.refreshToken.count()).toBe(0);
  });

  it("`me` returns the logged-in employee, and fails when anonymous", async () => {
    const emp = await createEmployee({ name: "Asha" });
    const ok = await run<{ me: { name: string } }>("{ me { name } }", {}, asAuth(emp));
    expect(ok.data?.me.name).toBe("Asha");
    expect(errorCode(await run("{ me { name } }"))).toBe("UNAUTHENTICATED");
  });

  it("`me` asks for a new login when the account was deleted after the token was issued", async () => {
    const emp = await createEmployee();
    await prisma.employee.delete({ where: { id: emp.id } });
    expect(errorCode(await run("{ me { name } }", {}, asAuth(emp)))).toBe("UNAUTHENTICATED");
  });
});

describe("refresh token rotation", () => {
  it("issues a new pair and spends the old token", async () => {
    const emp = await createEmployee();
    const first = await login(emp.phone);
    const res = await run<RefreshData>(REFRESH, { refreshToken: first.refreshToken });
    expect(res.errors).toBeUndefined();
    expect(res.data?.refreshTokens.refreshToken).not.toBe(first.refreshToken);
    expect(verifyAccessToken(res.data?.refreshTokens.accessToken ?? "")).toMatchObject({ employeeId: emp.id });
  });

  it("treats re-use of a spent token as theft: revokes every session of that employee", async () => {
    const emp = await createEmployee();
    const first = await login(emp.phone);
    const second = await run<RefreshData>(REFRESH, { refreshToken: first.refreshToken });
    const newest = second.data?.refreshTokens.refreshToken ?? "";

    const replay = await run(REFRESH, { refreshToken: first.refreshToken });
    expect(errorCode(replay)).toBe("UNAUTHENTICATED");

    // The legitimate, newer token is now dead too: the user has to log in again.
    expect(errorCode(await run(REFRESH, { refreshToken: newest }))).toBe("UNAUTHENTICATED");
    expect(await prisma.refreshToken.count({ where: { employeeId: emp.id, revokedAt: null } })).toBe(0);
  });

  it("does not revoke other employees' sessions", async () => {
    const a = await createEmployee();
    const b = await createEmployee();
    const aTok = await login(a.phone);
    const bTok = await login(b.phone);
    await run(REFRESH, { refreshToken: aTok.refreshToken });
    await run(REFRESH, { refreshToken: aTok.refreshToken }); // replay
    expect((await run(REFRESH, { refreshToken: bTok.refreshToken })).errors).toBeUndefined();
  });

  it("only one of two concurrent refreshes with the same token succeeds", async () => {
    const emp = await createEmployee();
    const { refreshToken } = await login(emp.phone);
    const results = await Promise.all([
      run(REFRESH, { refreshToken }),
      run(REFRESH, { refreshToken }),
    ]);
    expect(results.filter((r) => !r.errors)).toHaveLength(1);
    expect(results.filter((r) => r.errors)).toHaveLength(1);
  });

  it("rejects unknown and expired tokens", async () => {
    const emp = await createEmployee();
    const { refreshToken } = await login(emp.phone);
    expect(errorCode(await run(REFRESH, { refreshToken: "not-a-real-token" }))).toBe("UNAUTHENTICATED");

    await prisma.refreshToken.updateMany({
      where: { employeeId: emp.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await run(REFRESH, { refreshToken });
    expect(errorCode(res)).toBe("UNAUTHENTICATED");
    expect(res.errors?.[0]?.message).toMatch(/expired/i);
  });
});

describe("logout", () => {
  it("revokes the refresh token so it can no longer be used", async () => {
    const emp = await createEmployee();
    const { refreshToken } = await login(emp.phone);
    expect((await run<{ logout: boolean }>(LOGOUT, { refreshToken })).data?.logout).toBe(true);
    expect(errorCode(await run(REFRESH, { refreshToken }))).toBe("UNAUTHENTICATED");
  });

  it("is harmless for an unknown token", async () => {
    expect((await run<{ logout: boolean }>(LOGOUT, { refreshToken: "whatever" })).data?.logout).toBe(true);
  });
});
