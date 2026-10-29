import jwt from "jsonwebtoken";
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from "../../src/auth/tokens";

const SECRET = process.env.JWT_SECRET as string;

describe("access tokens", () => {
  it("round-trips employeeId and role, and reports the expiry", () => {
    const token = signAccessToken({ employeeId: "emp_1", role: "ADMIN" });
    const payload = verifyAccessToken(token);
    expect(payload).toMatchObject({ employeeId: "emp_1", role: "ADMIN" });
    // 15 minute lifetime (allow a little slack for slow machines)
    const secondsLeft = (payload?.exp ?? 0) - Math.floor(Date.now() / 1000);
    expect(secondsLeft).toBeGreaterThan(14 * 60);
    expect(secondsLeft).toBeLessThanOrEqual(15 * 60);
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ employeeId: "e", role: "REP" }, SECRET, { expiresIn: -10 });
    expect(verifyAccessToken(expired)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const forged = jwt.sign({ employeeId: "e", role: "ADMIN" }, "some-other-secret");
    expect(verifyAccessToken(forged)).toBeNull();
  });

  it("rejects a tampered payload (role escalation)", () => {
    const token = signAccessToken({ employeeId: "e", role: "REP" });
    const [header, , signature] = token.split(".");
    const evil = Buffer.from(JSON.stringify({ employeeId: "e", role: "ADMIN" })).toString("base64url");
    expect(verifyAccessToken(`${header}.${evil}.${signature}`)).toBeNull();
  });

  it("rejects alg=none tokens", () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ employeeId: "e", role: "ADMIN" })}.`;
    expect(verifyAccessToken(none)).toBeNull();
  });

  it("rejects tokens signed with a different HMAC algorithm (HS256 is pinned)", () => {
    const hs512 = jwt.sign({ employeeId: "e", role: "ADMIN" }, SECRET, { algorithm: "HS512" });
    expect(verifyAccessToken(hs512)).toBeNull();
  });

  it("rejects validly signed tokens with a missing or unknown claim", () => {
    expect(verifyAccessToken(jwt.sign({ role: "REP" }, SECRET))).toBeNull();
    expect(verifyAccessToken(jwt.sign({ employeeId: 42, role: "REP" }, SECRET))).toBeNull();
    expect(verifyAccessToken(jwt.sign({ employeeId: "e", role: "SUPERUSER" }, SECRET))).toBeNull();
    expect(verifyAccessToken(jwt.sign({ employeeId: "e" }, SECRET))).toBeNull();
  });

  it("returns null (never throws) for garbage", () => {
    for (const junk of ["", "abc", "a.b.c", "Bearer x", " "]) {
      expect(verifyAccessToken(junk)).toBeNull();
    }
  });
});

describe("refresh tokens", () => {
  it("are long, random and unique", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[0-9a-f]{96}$/);
    expect(a).not.toBe(b);
  });

  it("are stored as a deterministic SHA-256 hash, never the token itself", () => {
    const token = generateRefreshToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).not.toBe(hashToken(`${token}x`));
  });
});
