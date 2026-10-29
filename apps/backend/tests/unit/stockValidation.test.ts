import { catalogMutations } from "../../src/resolvers/catalog";
import { prisma } from "../../src/prisma";

jest.mock("../../src/prisma", () => ({
  prisma: { product: { update: jest.fn() } },
}));

const update = (prisma as unknown as { product: { update: jest.Mock } }).product.update;
const ADMIN = { auth: { employeeId: "a", role: "ADMIN" as const } };
const REP = { auth: { employeeId: "r", role: "REP" as const } };
const call = (ctx: typeof ADMIN | typeof REP | { auth: null }, stockQuantity: number) =>
  catalogMutations.updateProductStock({}, { productId: "p1", stockQuantity }, ctx as never);

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { extensions?: { code?: string } }).extensions?.code;
  }
  return "no error";
}

beforeEach(() => {
  update.mockReset();
  update.mockResolvedValue({ id: "p1" });
});

describe("updateProductStock validation", () => {
  it.each([-1, 1.5, NaN, 1_000_001])("rejects %p", async (n) => {
    expect(await codeOf(call(ADMIN, n))).toBe("BAD_USER_INPUT");
    expect(update).not.toHaveBeenCalled();
  });

  it.each([0, 1, 999_999, 1_000_000])("accepts the boundary/normal value %p", async (n) => {
    expect(await codeOf(call(ADMIN, n))).toBe("no error");
    expect(update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { stockQuantity: n } });
  });

  it("is admin-only, checked before validation or any write", async () => {
    expect(await codeOf(call(REP, 5))).toBe("FORBIDDEN");
    expect(await codeOf(call({ auth: null }, 5))).toBe("UNAUTHENTICATED");
    expect(update).not.toHaveBeenCalled();
  });
});
