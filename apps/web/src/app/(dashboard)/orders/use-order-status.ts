"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { OrderStatus } from "@/lib/queries";
import { updateOrderStatusAction } from "./actions";

// Optimistic status changes with automatic rollback.
//
// useOptimistic layers a temporary value on top of the real data (`items`, which comes from the
// server). While the transition runs the UI shows the temporary value; when it ends, React
// drops the layer and shows whatever `items` is then:
//   - success: the action called refresh(), so `items` already holds the confirmed status
//   - failure: `items` is unchanged, so the UI snaps back to the old status (the rollback)
// There is no hand-written rollback code to forget.
export function useOrderStatusChange<T extends { id: string; status: OrderStatus }>(items: T[]) {
  const [optimistic, applyOptimistic] = useOptimistic(
    items,
    (current, change: { id: string; status: OrderStatus }) =>
      current.map((item) => (item.id === change.id ? { ...item, status: change.status } : item))
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const change = (id: string, status: OrderStatus) => {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id, status });
      const result = await updateOrderStatusAction(id, status);
      if (!result.ok) setError(result.message);
    });
  };

  return { items: optimistic, pending, error, dismissError: () => setError(null), change };
}
