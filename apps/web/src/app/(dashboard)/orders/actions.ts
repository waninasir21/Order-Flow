"use server";

import { refresh } from "next/cache";
import { toFailure, type ActionResult } from "@/lib/action-result";
import { getAdmin } from "@/lib/dal";
import { STATUSES } from "@/lib/format";
import { gql } from "@/lib/graphql";
import { UPDATE_ORDER_STATUS, type OrderStatus } from "@/lib/queries";

// A Server Action is a public POST endpoint: anyone can call it with any arguments, so it
// re-checks who is calling and validates its input, exactly like an API route would.
export async function updateOrderStatusAction(orderId: string, status: OrderStatus): Promise<ActionResult> {
  await getAdmin();
  if (typeof orderId !== "string" || orderId.length === 0 || orderId.length > 64) {
    return { ok: false, message: "Invalid order." };
  }
  if (!STATUSES.includes(status)) return { ok: false, message: "Invalid status." };

  try {
    await gql(UPDATE_ORDER_STATUS, { orderId, status });
  } catch (e) {
    const failure = toFailure(e);
    // The screen was out of date (someone else changed the order): re-render with the truth.
    if (failure.stale) refresh();
    return { ok: false, message: failure.message };
  }
  // Re-renders the current page's server components in the same response, so the client gets
  // the real data in the same transition as the action result (the optimistic value is
  // replaced by the confirmed one without a flash).
  refresh();
  return { ok: true };
}
