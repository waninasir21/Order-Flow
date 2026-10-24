import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";
import type { Order } from "@/graphql/types";
import { isNetworkFailure } from "@/lib/errors";
import { sendCreateOrder } from "@/lib/sendOrder";
import { isOffline } from "@/offline/network";
import { useOutbox, type PendingItem, type PendingOrder } from "@/offline/outbox";
import { scheduleSync } from "@/offline/sync";
import { useAuthStore } from "@/stores/auth";

export interface CreateOrderInput {
  outletId: string;
  outletName: string; // kept with a queued order so it can be shown while offline
  lines: PendingItem[];
}

export type CreateOrderResult =
  | { kind: "synced"; order: Order } // the server has it
  | { kind: "queued"; pending: PendingOrder }; // saved on the phone, will sync later

// The ONE place screens place an order. Online: send it now. No connection (or the server
// can't be reached): save it to the local queue instead and let the sync manager send it.
// Definitive server errors (e.g. INSUFFICIENT_STOCK) are thrown to the caller, not queued,
// because retrying later would not change the answer.
export function useCreateOrder() {
  const [loading, setLoading] = useState(false);

  const createOrder = useCallback(async (input: CreateOrderInput): Promise<CreateOrderResult> => {
    const employeeId = useAuthStore.getState().employee?.id;
    if (!employeeId) throw new Error("You must be signed in to place an order");

    // Generated before the first attempt and reused for every retry of this order. It is
    // the queue row's id AND the server's idempotency key, which is what lets us match the
    // local order to the server's copy and never create it twice.
    const clientId = Crypto.randomUUID();
    const items = input.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));

    setLoading(true);
    try {
      let reachedNetwork = false;
      if (!isOffline()) {
        reachedNetwork = true;
        try {
          const order = await sendCreateOrder({ clientId, outletId: input.outletId, items });
          return { kind: "synced", order };
        } catch (e) {
          if (!isNetworkFailure(e)) throw e;
          // No answer from the server: fall through and queue it.
        }
      }

      const pending = await useOutbox.getState().enqueue({
        id: clientId,
        employeeId,
        outletId: input.outletId,
        outletName: input.outletName,
        items: input.lines,
        total: input.lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
      });
      // The phone looked online but the send failed: no "back online" event is coming,
      // so schedule our own retry.
      if (reachedNetwork) scheduleSync();
      return { kind: "queued", pending };
    } finally {
      setLoading(false);
    }
  }, []);

  return { createOrder, loading };
}
