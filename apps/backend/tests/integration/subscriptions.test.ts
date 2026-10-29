import { parse, subscribe, type ExecutionResult } from "graphql";
import { schema } from "../../src/schema";
import type { AccessPayload } from "../../src/auth/tokens";
import { asAuth, createEmployee, createOutlet, createProduct } from "../helpers/db";
import { CREATE_ORDER, UPDATE_STATUS, run } from "../helpers/gql";

// Tests the visibility rules of `orderStatusChanged` through the real schema and PubSub.
// (The WebSocket transport itself is not covered; see docs/10-testing.md.)
const SUB = parse(/* GraphQL */ `subscription ($outletId: ID) { orderStatusChanged(outletId: $outletId) { id status } }`);

type Payload = { orderStatusChanged: { id: string; status: string } };

async function listen(auth: AccessPayload | null, variableValues: Record<string, unknown> = {}) {
  const result = await subscribe({ schema, document: SUB, contextValue: { auth }, variableValues });
  if (!("next" in result)) return { iterator: null, errors: result.errors };
  const iterator = result as AsyncGenerator<ExecutionResult<Payload>>;
  // Start waiting right away so the subscription is registered before events are published.
  const first = iterator.next();
  const received: string[] = [];
  const done = first.then(function collect(r): Promise<void> | void {
    if (r.done) return;
    received.push(r.value.data!.orderStatusChanged.id);
    return iterator.next().then(collect);
  });
  void done.catch(() => undefined);
  return { iterator, received, errors: undefined };
}

const tick = () => new Promise((r) => setTimeout(r, 200));

async function order(rep: Awaited<ReturnType<typeof createEmployee>>, outletId: string, productId: string) {
  const res = await run<{ createOrder: { id: string } }>(CREATE_ORDER, { outletId, items: [{ productId, quantity: 1 }] }, asAuth(rep));
  return res.data!.createOrder.id;
}

describe("orderStatusChanged visibility", () => {
  it("rejects anonymous subscribers", async () => {
    const { errors } = await listen(null);
    expect(errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("shows a rep only their own orders, an admin everything", async () => {
    const [repA, repB, admin] = [await createEmployee(), await createEmployee(), await createEmployee({ role: "ADMIN" })];
    const [outA, outB] = [await createOutlet([repA.id]), await createOutlet([repB.id])];
    const product = await createProduct();
    const [orderA, orderB] = [await order(repA, outA.id, product.id), await order(repB, outB.id, product.id)];

    const asRepA = await listen(asAuth(repA));
    const asAdmin = await listen(asAuth(admin));

    await run(UPDATE_STATUS, { orderId: orderB, status: "APPROVED" }, asAuth(admin));
    await run(UPDATE_STATUS, { orderId: orderA, status: "APPROVED" }, asAuth(admin));
    await tick();

    expect(asRepA.received).toEqual([orderA]);
    expect(asAdmin.received).toEqual([orderB, orderA]);
    await asRepA.iterator?.return?.(undefined);
    await asAdmin.iterator?.return?.(undefined);
  });

  it("narrows to one outlet when outletId is given", async () => {
    const [rep, admin] = [await createEmployee(), await createEmployee({ role: "ADMIN" })];
    const [out1, out2] = [await createOutlet([rep.id]), await createOutlet([rep.id])];
    const product = await createProduct();
    const [o1, o2] = [await order(rep, out1.id, product.id), await order(rep, out2.id, product.id)];

    const sub = await listen(asAuth(admin), { outletId: out2.id });
    await run(UPDATE_STATUS, { orderId: o1, status: "REJECTED" }, asAuth(admin));
    await run(UPDATE_STATUS, { orderId: o2, status: "REJECTED" }, asAuth(admin));
    await tick();

    expect(sub.received).toEqual([o2]);
    await sub.iterator?.return?.(undefined);
  });

  it("does not deliver on an expired token", async () => {
    const [rep, admin] = [await createEmployee(), await createEmployee({ role: "ADMIN" })];
    const outlet = await createOutlet([rep.id]);
    const product = await createProduct();
    const id = await order(rep, outlet.id, product.id);

    const expired = { ...asAuth(admin), exp: Math.floor(Date.now() / 1000) - 5 };
    const sub = await listen(expired);
    await run(UPDATE_STATUS, { orderId: id, status: "APPROVED" }, asAuth(admin));
    await tick();

    expect(sub.received).toEqual([]);
    await sub.iterator?.return?.(undefined);
  });
});
