import { prisma } from "../../src/prisma";
import { asAuth, createEmployee, createOutlet, createProduct } from "../helpers/db";
import { CREATE_ORDER, errorCode, run, UPDATE_STATUS } from "../helpers/gql";

const SET_STOCK = /* GraphQL */ `
  mutation ($productId: ID!, $stockQuantity: Int!) {
    updateProductStock(productId: $productId, stockQuantity: $stockQuantity) { id stockQuantity }
  }
`;

describe("updateProductStock", () => {
  it("sets an absolute value, admin only", async () => {
    const admin = await createEmployee({ role: "ADMIN" });
    const rep = await createEmployee();
    const p = await createProduct({ stock: 5 });

    const ok = await run<{ updateProductStock: { stockQuantity: number } }>(SET_STOCK, { productId: p.id, stockQuantity: 42 }, asAuth(admin));
    expect(ok.data?.updateProductStock.stockQuantity).toBe(42);
    expect(errorCode(await run(SET_STOCK, { productId: p.id, stockQuantity: 1 }, asAuth(rep)))).toBe("FORBIDDEN");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stockQuantity).toBe(42);
  });

  it("rejects negatives and absurd values, and 404s unknown products", async () => {
    const admin = await createEmployee({ role: "ADMIN" });
    const p = await createProduct({ stock: 5 });
    expect(errorCode(await run(SET_STOCK, { productId: p.id, stockQuantity: -1 }, asAuth(admin)))).toBe("BAD_USER_INPUT");
    expect(errorCode(await run(SET_STOCK, { productId: p.id, stockQuantity: 1_000_001 }, asAuth(admin)))).toBe("BAD_USER_INPUT");
    expect(errorCode(await run(SET_STOCK, { productId: "ghost", stockQuantity: 1 }, asAuth(admin)))).toBe("NOT_FOUND");
  });
});

describe("visibility", () => {
  it("a REP sees only their own orders and outlets; an ADMIN sees all; a foreign order is NOT_FOUND", async () => {
    const a = await createEmployee();
    const b = await createEmployee();
    const admin = await createEmployee({ role: "ADMIN" });
    const outletA = await createOutlet([a.id]);
    const outletB = await createOutlet([b.id]);
    const p = await createProduct();
    const place = (outletId: string, who: typeof a) =>
      run<{ createOrder: { id: string } }>(CREATE_ORDER, { outletId, items: [{ productId: p.id, quantity: 1 }] }, asAuth(who));
    const orderA = (await place(outletA.id, a)).data!.createOrder.id;
    const orderB = (await place(outletB.id, b)).data!.createOrder.id;

    const list = (who: typeof a) => run<{ orders: { id: string }[] }>("{ orders { id } }", {}, asAuth(who));
    expect((await list(a)).data!.orders.map((o) => o.id)).toEqual([orderA]);
    expect((await list(admin)).data!.orders.map((o) => o.id).sort()).toEqual([orderA, orderB].sort());
    expect(errorCode(await run("query($id: ID!){ order(id:$id){ id } }", { id: orderB }, asAuth(a)))).toBe("NOT_FOUND");

    const outlets = await run<{ outlets: { id: string }[] }>("{ outlets { id } }", {}, asAuth(a));
    expect(outlets.data!.outlets.map((o) => o.id)).toEqual([outletA.id]);
  });
});

describe("analytics", () => {
  async function seedOrders() {
    const admin = await createEmployee({ role: "ADMIN" });
    const rep = await createEmployee();
    const outlet = await createOutlet([rep.id]);
    const hot = await createProduct({ stock: 100, name: "Hot" });
    const cold = await createProduct({ stock: 100, name: "Cold" });
    const place = async (productId: string, quantity: number) =>
      (await run<{ createOrder: { id: string } }>(CREATE_ORDER, { outletId: outlet.id, items: [{ productId, quantity }] }, asAuth(rep))).data!.createOrder.id;
    return { admin, rep, hot, cold, place };
  }

  it("is admin-only", async () => {
    const rep = await createEmployee();
    for (const q of ["{ analyticsSummary { ordersThisWeek } }", "{ ordersPerDay { date } }", "{ topProducts { totalQuantityOrdered } }"]) {
      expect(errorCode(await run(q, {}, asAuth(rep)))).toBe("FORBIDDEN");
      expect(errorCode(await run(q))).toBe("UNAUTHENTICATED");
    }
  });

  it("topProducts ranks by units and leaves rejected orders out", async () => {
    const { admin, hot, cold, place } = await seedOrders();
    await place(hot.id, 5);
    await place(cold.id, 3);
    const rejected = await place(cold.id, 50); // would make `cold` the winner if counted
    await run(UPDATE_STATUS, { orderId: rejected, status: "REJECTED" }, asAuth(admin));

    const res = await run<{ topProducts: { product: { name: string }; totalQuantityOrdered: number }[] }>(
      "{ topProducts(limit: 5) { product { name } totalQuantityOrdered } }",
      {},
      asAuth(admin)
    );
    expect(res.data!.topProducts.map((t) => [t.product.name, t.totalQuantityOrdered])).toEqual([
      ["Hot", 5],
      ["Cold", 3],
    ]);
  });

  it("ordersPerDay returns one row per day, zero-filled, oldest first, ending today", async () => {
    const { admin, hot, place } = await seedOrders();
    await place(hot.id, 1);
    await place(hot.id, 1);
    const res = await run<{ ordersPerDay: { date: string; count: number }[] }>("{ ordersPerDay(days: 7) { date count } }", {}, asAuth(admin));
    const rows = res.data!.ordersPerDay;
    expect(rows).toHaveLength(7);
    expect(rows.slice(0, 6).every((r) => r.count === 0)).toBe(true);
    expect(rows[6]!.count).toBe(2);
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort());
  });

  it("buckets days in the business time zone (IST), not UTC", async () => {
    const { admin, hot, place } = await seedOrders();
    const id = await place(hot.id, 1);
    // 00:30 IST today is 19:00 UTC *yesterday*: a UTC-based query would put it on the wrong day.
    const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    await prisma.order.update({ where: { id }, data: { createdAt: new Date(`${todayIst}T00:30:00+05:30`) } });

    const res = await run<{ ordersPerDay: { date: string; count: number }[] }>("{ ordersPerDay(days: 3) { date count } }", {}, asAuth(admin));
    const today = res.data!.ordersPerDay.at(-1)!;
    expect(today.date).toBe(todayIst);
    expect(today.count).toBe(1);
    expect(res.data!.ordersPerDay.at(-2)!.count).toBe(0);
  });

  it("analyticsSummary counts pending approvals and stock levels", async () => {
    const { admin, hot, place } = await seedOrders();
    await createProduct({ stock: 0 });
    await createProduct({ stock: 3 });
    await createProduct({ stock: 9 });
    await createProduct({ stock: 10 }); // not low: the threshold is "under 10"
    const o1 = await place(hot.id, 1);
    await place(hot.id, 1);
    await run(UPDATE_STATUS, { orderId: o1, status: "APPROVED" }, asAuth(admin));

    const res = await run<{ analyticsSummary: Record<string, number> }>(
      "{ analyticsSummary { ordersThisWeek pendingApprovals lowStockProducts outOfStockProducts } }",
      {},
      asAuth(admin)
    );
    expect(res.data!.analyticsSummary).toEqual({
      ordersThisWeek: 2,
      pendingApprovals: 1,
      lowStockProducts: 2,
      outOfStockProducts: 1,
    });
  });
});
