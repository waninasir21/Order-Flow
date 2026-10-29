import { prisma } from "../../src/prisma";
import { ORDER_STATUS_CHANGED, pubsub } from "../../src/pubsub";
import { asAuth, createEmployee, createOutlet, createProduct } from "../helpers/db";
import { CREATE_ORDER, UPDATE_STATUS, errorCode, run } from "../helpers/gql";

async function placed(quantity = 4, stock = 50) {
  const rep = await createEmployee({ role: "REP" });
  const admin = await createEmployee({ role: "ADMIN" });
  const outlet = await createOutlet([rep.id]);
  const product = await createProduct({ stock });
  const res = await run<{ createOrder: { id: string } }>(
    CREATE_ORDER,
    { outletId: outlet.id, items: [{ productId: product.id, quantity }] },
    asAuth(rep)
  );
  return { rep, admin, outlet, product, orderId: res.data!.createOrder.id, repAuth: asAuth(rep), adminAuth: asAuth(admin) };
}
const statusOf = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQuantity;
const set = (orderId: string, status: string, auth: Parameters<typeof run>[2]) =>
  run<{ updateOrderStatus: { id: string; status: string } }>(UPDATE_STATUS, { orderId, status }, auth);

describe("updateOrderStatus", () => {
  it("lets an admin walk PLACED → APPROVED → FULFILLED", async () => {
    const { orderId, adminAuth } = await placed();
    expect((await set(orderId, "APPROVED", adminAuth)).data?.updateOrderStatus.status).toBe("APPROVED");
    expect((await set(orderId, "FULFILLED", adminAuth)).data?.updateOrderStatus.status).toBe("FULFILLED");
    expect(await statusOf(orderId)).toBe("FULFILLED");
  });

  it("is admin-only: a REP (even the order's owner) is FORBIDDEN, anonymous is UNAUTHENTICATED", async () => {
    const { orderId, repAuth } = await placed();
    expect(errorCode(await set(orderId, "APPROVED", repAuth))).toBe("FORBIDDEN");
    expect(errorCode(await set(orderId, "APPROVED", null))).toBe("UNAUTHENTICATED");
    expect(await statusOf(orderId)).toBe("PLACED");
  });

  it("refuses illegal transitions and leaves the order as it was", async () => {
    const { orderId, adminAuth } = await placed();
    const skip = await set(orderId, "FULFILLED", adminAuth);
    expect(errorCode(skip)).toBe("BAD_USER_INPUT");
    expect(skip.errors?.[0]?.message).toContain("Allowed from PLACED: APPROVED, REJECTED");
    expect(await statusOf(orderId)).toBe("PLACED");
  });

  it("treats REJECTED and FULFILLED as final", async () => {
    const a = await placed();
    await set(a.orderId, "REJECTED", a.adminAuth);
    expect(errorCode(await set(a.orderId, "APPROVED", a.adminAuth))).toBe("BAD_USER_INPUT");

    const b = await placed();
    await set(b.orderId, "APPROVED", b.adminAuth);
    await set(b.orderId, "FULFILLED", b.adminAuth);
    expect(errorCode(await set(b.orderId, "REJECTED", b.adminAuth))).toBe("BAD_USER_INPUT");
  });

  it("404s an unknown order", async () => {
    const admin = await createEmployee({ role: "ADMIN" });
    expect(errorCode(await set("ghost", "APPROVED", asAuth(admin)))).toBe("NOT_FOUND");
  });

  describe("stock", () => {
    it("returns the stock to the shelf when an order is rejected", async () => {
      const { orderId, product, adminAuth } = await placed(4, 50);
      expect(await stockOf(product.id)).toBe(46);
      await set(orderId, "REJECTED", adminAuth);
      expect(await stockOf(product.id)).toBe(50);
    });

    it("does not touch stock on approve or fulfil", async () => {
      const { orderId, product, adminAuth } = await placed(4, 50);
      await set(orderId, "APPROVED", adminAuth);
      await set(orderId, "FULFILLED", adminAuth);
      expect(await stockOf(product.id)).toBe(46);
    });

    it("restocks only once even if the rejection is repeated", async () => {
      const { orderId, product, adminAuth } = await placed(4, 50);
      await set(orderId, "REJECTED", adminAuth);
      await set(orderId, "REJECTED", adminAuth); // refused: already final
      expect(await stockOf(product.id)).toBe(50);
    });
  });

  it("when an admin approves and another rejects at the same moment, exactly one wins and stock stays consistent", async () => {
    const { orderId, product, adminAuth } = await placed(4, 50);
    const [approve, reject] = await Promise.all([
      set(orderId, "APPROVED", adminAuth),
      set(orderId, "REJECTED", adminAuth),
    ]);
    const winners = [approve, reject].filter((r) => !r.errors);
    const losers = [approve, reject].filter((r) => r.errors);
    expect(winners).toHaveLength(1);
    expect(["CONFLICT", "BAD_USER_INPUT"]).toContain(errorCode(losers[0]!));

    const final = await statusOf(orderId);
    expect(final).toBe(winners[0]?.data?.updateOrderStatus.status);
    expect(await stockOf(product.id)).toBe(final === "REJECTED" ? 50 : 46);
  });

  describe("subscription event", () => {
    it("is published after a successful change, carrying the updated order", async () => {
      const { orderId, adminAuth } = await placed();
      const iterator = pubsub.asyncIterableIterator<{ orderStatusChanged: { id: string; status: string } }>(ORDER_STATUS_CHANGED);
      const next = iterator.next();
      await set(orderId, "APPROVED", adminAuth);
      const { value } = await next;
      expect(value.orderStatusChanged).toMatchObject({ id: orderId, status: "APPROVED" });
      await iterator.return?.();
    });

    it("is not published when the change is refused", async () => {
      const { orderId, adminAuth } = await placed();
      const iterator = pubsub.asyncIterableIterator(ORDER_STATUS_CHANGED);
      let received = false;
      void iterator.next().then(() => (received = true));
      await set(orderId, "FULFILLED", adminAuth); // illegal
      await new Promise((r) => setTimeout(r, 150));
      expect(received).toBe(false);
      await iterator.return?.();
    });
  });
});
