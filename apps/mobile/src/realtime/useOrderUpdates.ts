import { useEffect } from "react";
import { apolloClient } from "@/apollo/client";
import { ORDER_STATUS_CHANGED } from "@/graphql/operations";
import type { Order } from "@/graphql/types";
import { applyOrderUpdate } from "./applyOrderUpdate";
import { notifyStatusChange, setUpNotifications } from "./notifications";

// App-wide subscription to order status changes. Mounted once, while signed in.
//
// Cleanup matters: the effect's return value unsubscribes and cancels any pending retry, so
// leaving the screen (or logging out) never leaves a second listener behind to double-handle
// every event.
export function useOrderUpdates() {
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let subscription: { unsubscribe: () => void } | undefined;

    void setUpNotifications();

    const start = (attempt: number) => {
      subscription = apolloClient
        .subscribe<{ orderStatusChanged: Order }>({
          query: ORDER_STATUS_CHANGED,
          // We write to the cache ourselves, deduped (see applyOrderUpdate).
          fetchPolicy: "no-cache",
        })
        .subscribe({
          next: ({ data }) => {
            const order = data?.orderStatusChanged;
            if (!order) return;
            if (applyOrderUpdate(apolloClient.cache, order)) void notifyStatusChange(order);
          },
          // The socket layer retries on its own; this is only for fatal errors (for example
          // the server refusing the subscription). Try again later instead of going deaf.
          error: (err) => {
            console.warn("Order subscription failed", err);
            if (cancelled) return;
            retryTimer = setTimeout(() => start(attempt + 1), Math.min(2 ** attempt * 1000, 30_000));
          },
        });
    };
    start(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      subscription?.unsubscribe();
    };
  }, []);
}
