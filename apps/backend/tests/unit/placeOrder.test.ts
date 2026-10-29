import { Prisma } from "@prisma/client";
import { placeOrder, changeOrderStatus } from "../../src/services/orders";
import { prisma } from "../../src/prisma";
import { publishOrderStatusChanged } from "../../src/pubsub";

// The service talks to Prisma only through `prisma`, so here it is replaced by a fake and
// the tests pin down the service's own logic: validation order, the stock check, merging,
// race handling. What the SQL actually does is covered by the integration suite.
jest.mock("../../src/prisma", () => {
  const tx = {
    product: { findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  return {
    prisma: {
      tx,
      employee: { findUnique: jest.fn() },
      outlet: { findUnique: jest.fn() },
      order: { findFirst: jest.fn() },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
jest.mock("../../src/pubsub", () => ({ publishOrderStatusChanged: jest.fn() }));

type Fake = {
  tx: {
    product: Record<"findMany" | "updateMany" | "update", jest.Mock>;
    order: Record<"create" | "findUnique" | "updateMany" | "findUniqueOrThrow", jest.Mock>;
  };
  employee: { findUnique: jest.Mock };
  outlet: { findUnique: jest.Mock };
  order: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};
const db = prisma as unknown as Fake;

const REP = { employeeId: "rep1", role: "REP" as const };
const ADMIN = { employeeId: "adm1", role: "ADMIN" as const };
const product = (id: string, stock: number) => ({
  id,
  name: `Product ${id}`,
  price: new Prisma.Decimal("5.00"),
  stockQuantity: stock,
});

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { extensions?: { code?: string } }).extensions?.code ?? `non-graphql: ${String(e)}`;
  }
  return "no error";
}

beforeEach(() => {
  jest.clearAllMocks();
  db.employee.findUnique.mockResolvedValue({ id: "rep1" });
  db.order.findFirst.mockResolvedValue(null);
  db.outlet.findUnique.mockResolvedValue({ id: "o1", employees: [{ id: "rep1" }] });
  db.tx.product.findMany.mockResolvedValue([product("p1", 10)]);
  db.tx.product.updateMany.mockResolvedValue({ count: 1 });
  db.tx.order.create.mockResolvedValue({ id: "ord1" });
});

describe("placeOrder: input validation (rejected before touching the database)", () => {
  it("needs at least one item", async () => {
    expect(await codeOf(placeOrder(REP, "o1", []))).toBe("BAD_USER_INPUT");
    expect(db.employee.findUnique).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity])("rejects quantity %p", async (quantity) => {
    expect(await codeOf(placeOrder(REP, "o1", [{ productId: "p1", quantity }]))).toBe("BAD_USER_INPUT");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a bad clientId (empty or longer than 64 chars)", async () => {
    const items = [{ productId: "p1", quantity: 1 }];
    expect(await codeOf(placeOrder(REP, "o1", items, ""))).toBe("BAD_USER_INPUT");
    expect(await codeOf(placeOrder(REP, "o1", items, "x".repeat(65)))).toBe("BAD_USER_INPUT");
    expect(await codeOf(placeOrder(REP, "o1", items, "x".repeat(64)))).toBe("no error");
  });
});

describe("placeOrder: authorization", () => {
  it("asks the user to log in again when the token outlived the employee", async () => {
    db.employee.findUnique.mockResolvedValue(null);
    expect(await codeOf(placeOrder(REP, "o1", [{ productId: "p1", quantity: 1 }]))).toBe("UNAUTHENTICATED");
  });

  it("404s an unknown outlet", async () => {
    db.outlet.findUnique.mockResolvedValue(null);
    expect(await codeOf(placeOrder(REP, "nope", [{ productId: "p1", quantity: 1 }]))).toBe("NOT_FOUND");
  });

  it("forbids a REP from ordering for an outlet that is not assigned to them", async () => {
    db.outlet.findUnique.mockResolvedValue({ id: "o1", employees: [] });
    expect(await codeOf(placeOrder(REP, "o1", [{ productId: "p1", quantity: 1 }]))).toBe("FORBIDDEN");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("lets an ADMIN order for any outlet", async () => {
    db.employee.findUnique.mockResolvedValue({ id: "adm1" });
    db.outlet.findUnique.mockResolvedValue({ id: "o1", employees: [] });
    expect(await codeOf(placeOrder(ADMIN, "o1", [{ productId: "p1", quantity: 1 }]))).toBe("no error");
  });
});

describe("placeOrder: stock check", () => {
  it("throws INSUFFICIENT_STOCK with details when the conditional decrement matches nothing", async () => {
    db.tx.product.findMany.mockResolvedValue([product("p1", 3)]);
    db.tx.product.updateMany.mockResolvedValue({ count: 0 });
    const err = await placeOrder(REP, "o1", [{ productId: "p1", quantity: 5 }]).catch((e) => e);
    expect(err.extensions).toMatchObject({
      code: "INSUFFICIENT_STOCK",
      productId: "p1",
      requested: 5,
      available: 3,
    });
    expect(db.tx.order.create).not.toHaveBeenCalled(); // no order without stock
  });

  it("decrements conditionally: only where stock >= quantity", async () => {
    await placeOrder(REP, "o1", [{ productId: "p1", quantity: 4 }]);
    expect(db.tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", stockQuantity: { gte: 4 } },
      data: { stockQuantity: { decrement: 4 } },
    });
  });

  it("merges duplicate lines into one decrement with the summed quantity", async () => {
    await placeOrder(REP, "o1", [
      { productId: "p1", quantity: 2 },
      { productId: "p1", quantity: 3 },
    ]);
    expect(db.tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(db.tx.product.updateMany.mock.calls[0][0].data).toEqual({ stockQuantity: { decrement: 5 } });
    const created = db.tx.order.create.mock.calls[0][0].data.items.create;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ productId: "p1", quantity: 5 });
  });

  it("snapshots the current price on the line item", async () => {
    await placeOrder(REP, "o1", [{ productId: "p1", quantity: 1 }]);
    const [line] = db.tx.order.create.mock.calls[0][0].data.items.create;
    expect(line.priceAtOrder.toString()).toBe("5");
  });

  it("404s when a product does not exist, listing the missing ids", async () => {
    db.tx.product.findMany.mockResolvedValue([]);
    const err = await placeOrder(REP, "o1", [{ productId: "ghost", quantity: 1 }]).catch((e) => e);
    expect(err.extensions).toMatchObject({ code: "NOT_FOUND", productIds: ["ghost"] });
  });
});

describe("placeOrder: idempotency (offline queue replays)", () => {
  const items = [{ productId: "p1", quantity: 1 }];

  it("returns the existing order for a known clientId without opening a transaction", async () => {
    db.order.findFirst.mockResolvedValue({ id: "already" });
    await expect(placeOrder(REP, "o1", items, "c-1")).resolves.toEqual({ id: "already" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("when two identical requests race, the loser (P2002) returns the winner's order", async () => {
    db.order.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "winner" });
    db.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" })
    );
    await expect(placeOrder(REP, "o1", items, "c-1")).resolves.toEqual({ id: "winner" });
  });

  it("does not swallow a P2002 when there is no clientId involved", async () => {
    const dup = new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" });
    db.$transaction.mockRejectedValueOnce(dup);
    await expect(placeOrder(REP, "o1", items)).rejects.toBe(dup);
  });
});

describe("changeOrderStatus", () => {
  const order = (status: string) => ({
    id: "ord1",
    status,
    items: [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 7 },
    ],
  });

  beforeEach(() => {
    db.tx.order.updateMany.mockResolvedValue({ count: 1 });
    db.tx.order.findUniqueOrThrow.mockResolvedValue({ id: "ord1" });
  });

  it("404s an unknown order", async () => {
    db.tx.order.findUnique.mockResolvedValue(null);
    expect(await codeOf(changeOrderStatus("x", "APPROVED"))).toBe("NOT_FOUND");
  });

  it("rejects an illegal transition and explains what is allowed", async () => {
    db.tx.order.findUnique.mockResolvedValue(order("PLACED"));
    const err = await changeOrderStatus("ord1", "FULFILLED").catch((e) => e);
    expect(err.extensions.code).toBe("BAD_USER_INPUT");
    expect(err.message).toContain("Allowed from PLACED: APPROVED, REJECTED");
    expect(db.tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("says so when the order is in a final status", async () => {
    db.tx.order.findUnique.mockResolvedValue(order("FULFILLED"));
    const err = await changeOrderStatus("ord1", "APPROVED").catch((e) => e);
    expect(err.message).toContain("FULFILLED is a final status");
  });

  it("uses compare-and-set: updates only if the status is still what it read", async () => {
    db.tx.order.findUnique.mockResolvedValue(order("PLACED"));
    await changeOrderStatus("ord1", "APPROVED");
    expect(db.tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "ord1", status: "PLACED" },
      data: { status: "APPROVED" },
    });
  });

  it("reports CONFLICT when another admin changed the status in between", async () => {
    db.tx.order.findUnique.mockResolvedValue(order("PLACED"));
    db.tx.order.updateMany.mockResolvedValue({ count: 0 });
    expect(await codeOf(changeOrderStatus("ord1", "APPROVED"))).toBe("CONFLICT");
  });

  it("returns stock for every line when an order is rejected, and not on approval", async () => {
    db.tx.order.findUnique.mockResolvedValue(order("PLACED"));
    await changeOrderStatus("ord1", "REJECTED");
    expect(db.tx.product.update).toHaveBeenCalledTimes(2);
    expect(db.tx.product.update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { stockQuantity: { increment: 7 } },
    });

    db.tx.product.update.mockClear();
    db.tx.order.findUnique.mockResolvedValue(order("PLACED"));
    await changeOrderStatus("ord1", "APPROVED");
    expect(db.tx.product.update).not.toHaveBeenCalled();
  });

  it("publishes after the change, and a failed broadcast does not fail the mutation", async () => {
    db.tx.order.findUnique.mockResolvedValue(order("PLACED"));
    (publishOrderStatusChanged as jest.Mock).mockRejectedValueOnce(new Error("broker down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(changeOrderStatus("ord1", "APPROVED")).resolves.toEqual({ id: "ord1" });
    expect(publishOrderStatusChanged).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("does not publish when the change was refused", async () => {
    db.tx.order.findUnique.mockResolvedValue(order("REJECTED"));
    await changeOrderStatus("ord1", "APPROVED").catch(() => undefined);
    expect(publishOrderStatusChanged).not.toHaveBeenCalled();
  });
});
