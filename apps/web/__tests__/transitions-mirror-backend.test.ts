import { ORDER_ACTIONS } from "@/lib/transitions";
// The dashboard keeps its own copy of the state machine (it decides which buttons to show).
// This test fails the moment the copy and the backend's real rules disagree.
import { ALLOWED_TRANSITIONS } from "../../backend/src/orderStatus";

describe("dashboard actions mirror the backend state machine", () => {
  it("offers exactly the transitions the backend allows, from every status", () => {
    for (const status of Object.keys(ALLOWED_TRANSITIONS) as (keyof typeof ALLOWED_TRANSITIONS)[]) {
      expect(ORDER_ACTIONS[status].map((a) => a.to).sort()).toEqual([...ALLOWED_TRANSITIONS[status]].sort());
    }
  });

  it("asks for confirmation on rejection only (it returns stock and cannot be undone)", () => {
    const confirming = Object.values(ORDER_ACTIONS).flat().filter((a) => a.confirm);
    expect(confirming.map((a) => a.to)).toEqual(["REJECTED"]);
  });
});
