import { prisma } from "../../src/prisma";
import { asAuth, createEmployee, createOutlet, createProduct } from "../helpers/db";
import { CREATE_ORDER, errorCode, run } from "../helpers/gql";

type Created = {
  createOrder: {
    id: string;
    status: string;
    clientId: string | null;
    total: number;
    items: { quantity: number; priceAtOrder: number; product: { id: string } }[];
  };
};

async function setup(stock = 50) {
  const rep = await createEmployee({ role: "REP" });
  const outlet = await createOutlet([rep.id]);
  const product = await createProduct({ stock, price: "12.50" });
  return { rep, outlet, product, auth: asAuth(rep) };
}
const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQuantity;

describe("createOrder", () => {
  it("creates a PLACED order, snapshots the price, computes the total and deducts stock", async () => {
    const { outlet, product, auth } = await setup(50);
    const res = await run<Created>(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 4 }] }, auth);

    expect(res.errors).toBeUndefined();
    const order = res.data!.createOrder;
    expect(order.status).toBe("PLACED");
    expect(order.total).toBe(50); // 4 x 12.50
    expect(order.items).toEqual([{ quantity: 4, priceAtOrder: 12.5, product: { id: product.id } }]);
    expect(await stockOf(product.id)).toBe(46);
  });

  it("keeps the old price on existing orders after a price change", async () => {
    const { outlet, product, auth } = await setup();
    const res = await run<Created>(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 1 }] }, auth);
    await prisma.product.update({ where: { id: product.id }, data: { price: "99.00" } });
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: res.data!.createOrder.id } });
    expect(item.priceAtOrder.toString()).toBe("12.5");
  });

  it("merges the same product listed twice into one line", async () => {
    const { outlet, product, auth } = await setup(50);
    const res = await run<Created>(
      CREATE_ORDER,
      { outletId: outlet.id, items: [{ productId: product.id, quantity: 2 }, { productId: product.id, quantity: 3 }] },
      auth
    );
    expect(res.data!.createOrder.items).toHaveLength(1);
    expect(res.data!.createOrder.items[0]?.quantity).toBe(5);
    expect(await stockOf(product.id)).toBe(45);
  });

  it("refuses an order that exceeds stock, and changes nothing", async () => {
    const { outlet, product, auth } = await setup(3);
    const res = await run(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 4 }] }, auth);
    expect(errorCode(res)).toBe("INSUFFICIENT_STOCK");
    expect(res.errors?.[0]?.extensions).toMatchObject({ productId: product.id, requested: 4, available: 3 });
    expect(await stockOf(product.id)).toBe(3);
    expect(await prisma.order.count()).toBe(0);
  });

  it("allows ordering exactly the remaining stock", async () => {
    const { outlet, product, auth } = await setup(3);
    const res = await run(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 3 }] }, auth);
    expect(res.errors).toBeUndefined();
    expect(await stockOf(product.id)).toBe(0);
  });

  it("is all-or-nothing: if the second line is short, the first line's stock is not deducted", async () => {
    const { outlet, product, auth } = await setup(10);
    const scarce = await createProduct({ stock: 1 });
    const res = await run(
      CREATE_ORDER,
      { outletId: outlet.id, items: [{ productId: product.id, quantity: 5 }, { productId: scarce.id, quantity: 2 }] },
      auth
    );
    expect(errorCode(res)).toBe("INSUFFICIENT_STOCK");
    expect(await stockOf(product.id)).toBe(10);
    expect(await stockOf(scarce.id)).toBe(1);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
  });

  it("404s an unknown product without touching other lines", async () => {
    const { outlet, product, auth } = await setup(10);
    const res = await run(
      CREATE_ORDER,
      { outletId: outlet.id, items: [{ productId: product.id, quantity: 1 }, { productId: "ghost", quantity: 1 }] },
      auth
    );
    expect(errorCode(res)).toBe("NOT_FOUND");
    expect(await stockOf(product.id)).toBe(10);
  });

  it("requires login", async () => {
    const { outlet, product } = await setup();
    const res = await run(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 1 }] });
    expect(errorCode(res)).toBe("UNAUTHENTICATED");
  });

  it("rejects non-positive quantities and empty orders", async () => {
    const { outlet, product, auth } = await setup();
    expect(errorCode(await run(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 0 }] }, auth))).toBe("BAD_USER_INPUT");
    expect(errorCode(await run(CREATE_ORDER, { outletId: outlet.id, items: [] }, auth))).toBe("BAD_USER_INPUT");
  });

  describe("outlet access", () => {
    it("forbids a REP from an outlet that is not theirs", async () => {
      const { product, auth } = await setup();
      const other = await createOutlet([]);
      const res = await run(CREATE_ORDER, { outletId: other.id, items: [{ productId: product.id, quantity: 1 }] }, auth);
      expect(errorCode(res)).toBe("FORBIDDEN");
      expect(await stockOf(product.id)).toBe(50);
    });

    it("lets an ADMIN order for any outlet", async () => {
      const admin = await createEmployee({ role: "ADMIN" });
      const outlet = await createOutlet([]);
      const product = await createProduct();
      const res = await run(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 1 }] }, asAuth(admin));
      expect(res.errors).toBeUndefined();
    });

    it("tells a deleted employee's token to log in again instead of a raw FK error", async () => {
      const { outlet, product, rep, auth } = await setup();
      await prisma.employee.delete({ where: { id: rep.id } });
      const res = await run(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 1 }] }, auth);
      expect(errorCode(res)).toBe("UNAUTHENTICATED");
    });
  });

  describe("idempotency (offline queue replays)", () => {
    it("returns the same order for a repeated clientId and deducts stock once", async () => {
      const { outlet, product, auth } = await setup(50);
      const vars = { outletId: outlet.id, items: [{ productId: product.id, quantity: 5 }], clientId: "offline-1" };
      const a = await run<Created>(CREATE_ORDER, vars, auth);
      const b = await run<Created>(CREATE_ORDER, vars, auth);
      expect(a.errors).toBeUndefined();
      expect(b.data?.createOrder.id).toBe(a.data?.createOrder.id);
      expect(b.data?.createOrder.clientId).toBe("offline-1");
      expect(await prisma.order.count()).toBe(1);
      expect(await stockOf(product.id)).toBe(45);
    });

    it("replays succeed even after the stock ran out (the order already exists)", async () => {
      const { outlet, product, auth } = await setup(5);
      const vars = { outletId: outlet.id, items: [{ productId: product.id, quantity: 5 }], clientId: "offline-2" };
      const first = await run<Created>(CREATE_ORDER, vars, auth);
      const replay = await run<Created>(CREATE_ORDER, vars, auth);
      expect(replay.errors).toBeUndefined();
      expect(replay.data?.createOrder.id).toBe(first.data?.createOrder.id);
    });

    it("scopes clientId per employee: two reps can use the same clientId", async () => {
      const { outlet, product, auth } = await setup(50);
      const rep2 = await createEmployee();
      const outlet2 = await createOutlet([rep2.id]);
      const a = await run<Created>(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 1 }], clientId: "same" }, auth);
      const b = await run<Created>(CREATE_ORDER, { outletId: outlet2.id, items: [{ productId: product.id, quantity: 1 }], clientId: "same" }, asAuth(rep2));
      expect(a.errors).toBeUndefined();
      expect(b.errors).toBeUndefined();
      expect(b.data?.createOrder.id).not.toBe(a.data?.createOrder.id);
    });

    it("survives a burst of identical concurrent requests: one order, stock deducted once", async () => {
      const { outlet, product, auth } = await setup(50);
      const vars = { outletId: outlet.id, items: [{ productId: product.id, quantity: 7 }], clientId: "burst" };
      const results = await Promise.all(Array.from({ length: 6 }, () => run<Created>(CREATE_ORDER, vars, auth)));
      expect(results.every((r) => !r.errors)).toBe(true);
      expect(new Set(results.map((r) => r.data!.createOrder.id)).size).toBe(1);
      expect(await prisma.order.count()).toBe(1);
      expect(await stockOf(product.id)).toBe(43);
    });
  });

  it("never oversells under load: 12 concurrent orders for 5 units, exactly 5 succeed", async () => {
    const product = await createProduct({ stock: 5 });
    const reps = await Promise.all(Array.from({ length: 12 }, () => createEmployee()));
    const attempts = await Promise.all(
      reps.map(async (rep) => {
        const outlet = await createOutlet([rep.id]);
        return run(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 1 }] }, asAuth(rep));
      })
    );
    expect(attempts.filter((r) => !r.errors)).toHaveLength(5);
    expect(attempts.filter((r) => errorCode(r) === "INSUFFICIENT_STOCK")).toHaveLength(7);
    expect(await stockOf(product.id)).toBe(0);
  });

  it("never oversells: two reps racing for the last unit, exactly one wins", async () => {
    const product = await createProduct({ stock: 1 });
    const reps = await Promise.all([createEmployee(), createEmployee(), createEmployee()]);
    const attempts = await Promise.all(
      reps.map(async (rep) => {
        const outlet = await createOutlet([rep.id]);
        return run(CREATE_ORDER, { outletId: outlet.id, items: [{ productId: product.id, quantity: 1 }] }, asAuth(rep));
      })
    );
    expect(attempts.filter((r) => !r.errors)).toHaveLength(1);
    expect(attempts.filter((r) => errorCode(r) === "INSUFFICIENT_STOCK")).toHaveLength(2);
    expect(await stockOf(product.id)).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });
});
