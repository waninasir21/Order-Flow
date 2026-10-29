import type { OrderStatus } from "@prisma/client";
import { ALLOWED_TRANSITIONS, canTransition } from "../../src/orderStatus";

const ALL: OrderStatus[] = ["PLACED", "APPROVED", "REJECTED", "FULFILLED"];

// The complete 4x4 matrix, written out so a change to the state machine has to change a test.
const LEGAL = new Set(["PLACED>APPROVED", "PLACED>REJECTED", "APPROVED>FULFILLED"]);

describe("order status state machine", () => {
  const cases = ALL.flatMap((from) => ALL.map((to) => [from, to] as const));

  it.each(cases)("%s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(LEGAL.has(`${from}>${to}`));
  });

  it("never allows a status to 'change' to itself", () => {
    for (const s of ALL) expect(canTransition(s, s)).toBe(false);
  });

  it("treats REJECTED and FULFILLED as terminal", () => {
    expect(ALLOWED_TRANSITIONS.REJECTED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.FULFILLED).toEqual([]);
  });

  it("does not allow skipping approval (PLACED → FULFILLED)", () => {
    expect(canTransition("PLACED", "FULFILLED")).toBe(false);
  });
});
