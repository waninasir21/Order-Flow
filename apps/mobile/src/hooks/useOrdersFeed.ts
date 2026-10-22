import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { ORDERS } from "@/graphql/operations";
import type { Order } from "@/graphql/types";
import { useOutbox, type PendingOrder } from "@/offline/outbox";
import { useAuthStore } from "@/stores/auth";

export type FeedItem =
  | { kind: "pending"; key: string; pending: PendingOrder }
  | { kind: "server"; key: string; order: Order };

// One list for the order screens: this user's queued (not yet synced) orders on top, then
// the server's orders. A queued order is hidden as soon as the server's copy shows up
// (matched by the shared clientId), so the swap never shows a duplicate.
export function useOrdersFeed(outletId?: string) {
  const query = useQuery<{ orders: Order[] }>(ORDERS, { fetchPolicy: "cache-and-network" });
  const employeeId = useAuthStore((s) => s.employee?.id);
  const rows = useOutbox((s) => s.rows);

  const { items, unsyncedCount } = useMemo(() => {
    const serverOrders = query.data?.orders ?? [];
    const syncedClientIds = new Set(
      serverOrders.map((o) => o.clientId).filter((id): id is string => !!id)
    );

    const mine = rows.filter((r) => r.employeeId === employeeId && !syncedClientIds.has(r.id));
    const pending = mine
      .filter((r) => !outletId || r.outletId === outletId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const server = serverOrders.filter((o) => !outletId || o.outlet.id === outletId);

    const list: FeedItem[] = [
      ...pending.map((p): FeedItem => ({ kind: "pending", key: `p-${p.id}`, pending: p })),
      ...server.map((o): FeedItem => ({ kind: "server", key: o.id, order: o })),
    ];
    return { items: list, unsyncedCount: mine.length };
  }, [query.data, rows, employeeId, outletId]);

  return { items, unsyncedCount, query };
}
