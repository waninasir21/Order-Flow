import { describeError, errorCode, isNetworkFailure } from "@/lib/errors";
import { sendCreateOrder } from "@/lib/sendOrder";
import { useAuthStore } from "@/stores/auth";
import { isOffline } from "./network";
import { useOutbox } from "./outbox";

const RETRY_DELAY_MS = 15_000;

let running = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// Try again shortly. Used when a send failed because the network or server was unreachable
// even though the phone thinks it is online (so no "back online" event will fire).
export function scheduleSync(delayMs: number = RETRY_DELAY_MS): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncOutbox();
  }, delayMs);
}

// Sends queued orders one at a time, oldest first. Sequential on purpose: parallel sends
// would race on stock and could land out of order. Safe to call from anywhere, any time:
// if a run is already in progress, this call does nothing.
export async function syncOutbox(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (true) {
      const { employee, refreshToken } = useAuthStore.getState();
      if (!employee || !refreshToken) return; // signed out: orders stay queued for next login
      if (isOffline()) return; // the "back online" event will call us again

      // Only this user's orders, and only PENDING (FAILED waits for a manual retry).
      const next = useOutbox
        .getState()
        .rows.find((r) => r.employeeId === employee.id && r.syncStatus === "PENDING");
      if (!next) return;

      await useOutbox.getState().setStatus(next.id, "SYNCING");
      try {
        await sendCreateOrder({
          clientId: next.id,
          outletId: next.outletId,
          items: next.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        });
      } catch (e) {
        // Unknown outcome (no network, timeout, 5xx) or a session that needs refreshing:
        // keep the order queued and try again later. Not the user's problem, not a failure.
        if (isNetworkFailure(e) || errorCode(e) === "UNAUTHENTICATED") {
          await useOutbox.getState().setStatus(next.id, "PENDING");
          scheduleSync();
          return;
        }
        // The server definitively said no (stock ran out, outlet no longer assigned, ...).
        // Mark it FAILED with the server's message and carry on with the next order.
        await useOutbox.getState().setStatus(next.id, "FAILED", describeError(e));
        continue;
      }
      // Success. The new order is already in the Apollo cache (sendCreateOrder did that),
      // so dropping the local row now cannot make the order disappear from the list. If the
      // app dies between these two lines, the next launch resends and the server's
      // clientId check returns the same order, so there is still no duplicate.
      await useOutbox.getState().remove(next.id);
    }
  } finally {
    running = false;
  }
}
