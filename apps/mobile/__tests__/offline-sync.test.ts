/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The offline order queue (Week 4): the trickiest code in the app, so it gets the most
 * thorough tests. What runs for real: the outbox store, the sync loop, the error
 * classification, and the actual SQL against a real SQLite engine (node:sqlite standing in
 * for expo-sqlite). What is faked: the network call (`sendCreateOrder`) and "is the phone
 * online".
 *
 * Each `load()` re-imports the modules, which is what a fresh app launch looks like. The
 * SQLite database lives outside the module registry, so it survives a "relaunch" the way the
 * on-disk file survives the app being killed.
 */
type TestGlobals = { __testDb?: import("node:sqlite").DatabaseSync };
const g = globalThis as unknown as TestGlobals;

jest.mock("expo-sqlite", () => {
  const wrap = (d: import("node:sqlite").DatabaseSync) => ({
    execAsync: async (sql: string) => void d.exec(sql),
    runAsync: async (sql: string, params: unknown[] = []) =>
      void d.prepare(sql).run(...(params as never[])),
    getAllAsync: async (sql: string, params: unknown[] = []) =>
      d.prepare(sql).all(...(params as never[])),
  });
  return {
    openDatabaseAsync: async () => wrap((globalThis as unknown as TestGlobals).__testDb!),
  };
});
jest.mock("@/lib/sendOrder", () => ({ sendCreateOrder: jest.fn() }));
jest.mock("@/offline/network", () => ({ isOffline: jest.fn(() => false) }));

const EMP = { id: "emp1", name: "Asha", role: "REP" as const };

function load() {
  jest.resetModules();
  const outbox = require("@/offline/outbox") as typeof import("@/offline/outbox");
  const sync = require("@/offline/sync") as typeof import("@/offline/sync");
  const { useAuthStore } = require("@/stores/auth") as typeof import("@/stores/auth");
  const send = (require("@/lib/sendOrder") as { sendCreateOrder: jest.Mock }).sendCreateOrder;
  const network = (require("@/offline/network") as { isOffline: jest.Mock }).isOffline;
  return { useOutbox: outbox.useOutbox, syncOutbox: sync.syncOutbox, useAuthStore, send, network };
}
type Ctx = ReturnType<typeof load>;

function signIn(ctx: Ctx, employee = EMP) {
  ctx.useAuthStore.setState({ employee, refreshToken: "r", accessToken: "a" });
}

const order = (id: string, over: Partial<import("@/offline/outbox").PendingOrder> = {}) => ({
  id,
  employeeId: "emp1",
  outletId: "outlet1",
  outletName: "Sharma Store",
  items: [{ productId: "p1", name: "Biscuits", price: 10, quantity: 2 }],
  total: 20,
  ...over,
});

// Errors must come from the SAME module registry as the code under test (load() resets it),
// otherwise `error instanceof ApolloError` inside the app code would be false.
const apollo = () => require("@apollo/client") as typeof import("@apollo/client");
const networkDown = () => new (apollo().ApolloError)({ networkError: new Error("Network request failed") });
const serverSays = (code: string, message: string) => {
  const { GraphQLError } = require("graphql") as typeof import("graphql");
  return new (apollo().ApolloError)({ graphQLErrors: [new GraphQLError(message, { extensions: { code } })] });
};
const httpError = (statusCode: number) =>
  new (apollo().ApolloError)({ networkError: Object.assign(new Error(`HTTP ${statusCode}`), { statusCode }) });

const dbRows = () =>
  g.__testDb!.prepare("SELECT id, sync_status, error_message FROM pending_orders ORDER BY rowid").all() as {
    id: string;
    sync_status: string;
    error_message: string | null;
  }[];

let ctx: Ctx;

beforeEach(() => {
  jest.useFakeTimers();
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  g.__testDb = new DatabaseSync(":memory:");
  ctx = load();
  signIn(ctx);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  g.__testDb?.close();
});

describe("outbox persistence", () => {
  it("writes the order to SQLite before reporting it saved, so it survives the app being killed", async () => {
    await ctx.useOutbox.getState().enqueue(order("a"));
    expect(dbRows()).toEqual([{ id: "a", sync_status: "PENDING", error_message: null }]);

    // "Kill the app" and relaunch: fresh modules, same database file.
    const relaunched = load();
    await relaunched.useOutbox.getState().load();
    const [row] = relaunched.useOutbox.getState().rows;
    expect(row).toMatchObject({ id: "a", outletName: "Sharma Store", total: 20, syncStatus: "PENDING" });
    expect(row?.items).toEqual([{ productId: "p1", name: "Biscuits", price: 10, quantity: 2 }]);
  });

  it("keeps orders in creation order", async () => {
    for (const id of ["a", "b", "c"]) await ctx.useOutbox.getState().enqueue(order(id));
    await ctx.useOutbox.getState().load();
    expect(ctx.useOutbox.getState().rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("an order stuck at SYNCING after a crash goes back to PENDING on the next launch, once", async () => {
    await ctx.useOutbox.getState().enqueue(order("a"));
    await ctx.useOutbox.getState().setStatus("a", "SYNCING"); // app killed here

    const relaunched = load();
    await relaunched.useOutbox.getState().load();
    expect(relaunched.useOutbox.getState().rows[0]?.syncStatus).toBe("PENDING");

    // Within the same launch, a later load() must not touch a genuinely in-flight order.
    await relaunched.useOutbox.getState().setStatus("a", "SYNCING");
    await relaunched.useOutbox.getState().load();
    expect(relaunched.useOutbox.getState().rows[0]?.syncStatus).toBe("SYNCING");
  });
});

describe("syncOutbox: happy path", () => {
  it("sends the order with its local id as the idempotency key, then removes it from memory and disk", async () => {
    ctx.send.mockResolvedValue({ id: "server-1" });
    await ctx.useOutbox.getState().enqueue(order("local-uuid-1"));

    await ctx.syncOutbox();

    expect(ctx.send).toHaveBeenCalledTimes(1);
    expect(ctx.send).toHaveBeenCalledWith({
      clientId: "local-uuid-1",
      outletId: "outlet1",
      // Only ids and quantities go over the wire: the server prices the order itself.
      items: [{ productId: "p1", quantity: 2 }],
    });
    expect(ctx.useOutbox.getState().rows).toEqual([]);
    expect(dbRows()).toEqual([]);
  });

  it("sends orders one at a time, oldest first", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const sent: string[] = [];
    ctx.send.mockImplementation(async ({ clientId }: { clientId: string }) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      await Promise.resolve();
      sent.push(clientId);
      inFlight--;
      return { id: `server-${clientId}` };
    });
    for (const id of ["a", "b", "c"]) await ctx.useOutbox.getState().enqueue(order(id));

    await ctx.syncOutbox();

    expect(sent).toEqual(["a", "b", "c"]);
    expect(maxInFlight).toBe(1);
  });

  it("overlapping calls do nothing: never two requests in flight, no order sent twice", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    ctx.send.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      await Promise.resolve();
      inFlight--;
      return { id: "s" };
    });
    await ctx.useOutbox.getState().enqueue(order("a"));
    await ctx.useOutbox.getState().enqueue(order("b"));

    await Promise.all([ctx.syncOutbox(), ctx.syncOutbox(), ctx.syncOutbox()]);

    expect(ctx.send.mock.calls.map((c) => c[0].clientId)).toEqual(["a", "b"]);
    expect(maxInFlight).toBe(1);
  });

  it("marks the order SYNCING while the request is in flight", async () => {
    let release!: () => void;
    ctx.send.mockImplementation(() => new Promise((r) => (release = () => r({ id: "s" }))));
    await ctx.useOutbox.getState().enqueue(order("a"));

    const run = ctx.syncOutbox();
    await jest.advanceTimersByTimeAsync(0);
    expect(ctx.useOutbox.getState().rows[0]?.syncStatus).toBe("SYNCING");
    expect(dbRows()[0]?.sync_status).toBe("SYNCING");

    release();
    await run;
    expect(ctx.useOutbox.getState().rows).toEqual([]);
  });
});

describe("syncOutbox: when it must not send", () => {
  it("does nothing while the phone is offline, and keeps the order queued", async () => {
    ctx.network.mockReturnValue(true);
    await ctx.useOutbox.getState().enqueue(order("a"));
    await ctx.syncOutbox();
    expect(ctx.send).not.toHaveBeenCalled();
    expect(ctx.useOutbox.getState().rows[0]?.syncStatus).toBe("PENDING");
  });

  it("does nothing when signed out, and orders wait for the next login", async () => {
    await ctx.useOutbox.getState().enqueue(order("a"));
    ctx.useAuthStore.setState({ employee: null, refreshToken: null });
    await ctx.syncOutbox();
    expect(ctx.send).not.toHaveBeenCalled();
    expect(dbRows()).toHaveLength(1);
  });

  it("never sends another employee's orders from a shared phone", async () => {
    ctx.send.mockResolvedValue({ id: "s" });
    await ctx.useOutbox.getState().enqueue(order("theirs", { employeeId: "someone-else" }));
    await ctx.useOutbox.getState().enqueue(order("mine"));
    await ctx.syncOutbox();
    expect(ctx.send.mock.calls.map((c) => c[0].clientId)).toEqual(["mine"]);
    expect(ctx.useOutbox.getState().rows.map((r) => r.id)).toEqual(["theirs"]);
  });

  it("does not retry FAILED orders by itself; a manual retry (back to PENDING) sends them", async () => {
    await ctx.useOutbox.getState().enqueue(order("a"));
    await ctx.useOutbox.getState().setStatus("a", "FAILED", "Insufficient stock");
    await ctx.syncOutbox();
    expect(ctx.send).not.toHaveBeenCalled();

    ctx.send.mockResolvedValue({ id: "s" });
    await ctx.useOutbox.getState().setStatus("a", "PENDING");
    await ctx.syncOutbox();
    expect(ctx.send).toHaveBeenCalledTimes(1);
    expect(ctx.useOutbox.getState().rows).toEqual([]);
  });
});

describe("syncOutbox: failures", () => {
  it("a network failure is not the user's problem: back to PENDING, stop, retry in 15s with the same clientId", async () => {
    ctx.send.mockRejectedValueOnce(networkDown()).mockResolvedValue({ id: "s" });
    await ctx.useOutbox.getState().enqueue(order("a"));
    await ctx.useOutbox.getState().enqueue(order("b"));

    await ctx.syncOutbox();

    expect(ctx.send).toHaveBeenCalledTimes(1); // "b" is not attempted behind a dead network
    expect(ctx.useOutbox.getState().rows.map((r) => [r.id, r.syncStatus])).toEqual([
      ["a", "PENDING"],
      ["b", "PENDING"],
    ]);

    await jest.advanceTimersByTimeAsync(14_000);
    expect(ctx.send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_500);
    expect(ctx.send.mock.calls.map((c) => c[0].clientId)).toEqual(["a", "a", "b"]);
    expect(ctx.useOutbox.getState().rows).toEqual([]);
  });

  it.each([
    ["a timeout", () => Object.assign(new Error("timed out"), { isTimeout: true })],
    ["a 502 from the server", () => httpError(502)],
    ["an expired session", () => serverSays("UNAUTHENTICATED", "You must be logged in")],
  ])("%s keeps the order queued (outcome unknown / will recover)", async (_label, makeError) => {
    ctx.send.mockRejectedValueOnce(makeError());
    await ctx.useOutbox.getState().enqueue(order("a"));
    await ctx.syncOutbox();
    expect(ctx.useOutbox.getState().rows[0]).toMatchObject({ syncStatus: "PENDING", errorMessage: null });
  });

  it("a definitive server 'no' marks that order FAILED with the server's message and carries on", async () => {
    ctx.send
      .mockRejectedValueOnce(serverSays("INSUFFICIENT_STOCK", "Insufficient stock for Biscuits"))
      .mockResolvedValue({ id: "s" });
    await ctx.useOutbox.getState().enqueue(order("a"));
    await ctx.useOutbox.getState().enqueue(order("b"));

    await ctx.syncOutbox();

    expect(ctx.useOutbox.getState().rows).toHaveLength(1);
    expect(ctx.useOutbox.getState().rows[0]).toMatchObject({
      id: "a",
      syncStatus: "FAILED",
      errorMessage: "Insufficient stock for Biscuits",
    });
    expect(dbRows()).toEqual([{ id: "a", sync_status: "FAILED", error_message: "Insufficient stock for Biscuits" }]);
    expect(ctx.send).toHaveBeenCalledTimes(2); // b was still sent
  });

  it("a 4xx HTTP error is definitive (retrying cannot help), unlike a 5xx", async () => {
    ctx.send.mockRejectedValueOnce(httpError(400));
    await ctx.useOutbox.getState().enqueue(order("a"));
    await ctx.syncOutbox();
    expect(ctx.useOutbox.getState().rows[0]?.syncStatus).toBe("FAILED");
  });
});

describe("crash recovery (the no-duplicates guarantee)", () => {
  it("an order whose response was lost is re-sent after relaunch with the SAME clientId", async () => {
    // Launch 1: the request goes out, then the app dies before the response is handled.
    let release!: () => void;
    ctx.send.mockImplementation(() => new Promise((r) => (release = () => r({ id: "s" }))));
    await ctx.useOutbox.getState().enqueue(order("lost-response"));
    void ctx.syncOutbox();
    await jest.advanceTimersByTimeAsync(0);
    expect(dbRows()[0]?.sync_status).toBe("SYNCING"); // on disk when the process dies
    void release;

    // Launch 2.
    const relaunched = load();
    signIn(relaunched);
    relaunched.send.mockResolvedValue({ id: "s" });
    await relaunched.useOutbox.getState().load();
    await relaunched.syncOutbox();

    // The server de-duplicates on this key (covered by the backend integration tests), so
    // however many times it is sent, exactly one order exists.
    expect(relaunched.send).toHaveBeenCalledWith(expect.objectContaining({ clientId: "lost-response" }));
    expect(dbRows()).toEqual([]);
  });
});
