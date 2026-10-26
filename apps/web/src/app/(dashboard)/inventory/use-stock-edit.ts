"use client";

import { useOptimistic, useState, useTransition } from "react";
import { updateProductStockAction } from "./actions";

// Same pattern as the order status hook: the new number shows at once, and snaps back by itself
// if the server says no (the optimistic layer is dropped when the transition ends).
export function useStockEdit<T extends { id: string; stock: number }>(items: T[]) {
  const [optimistic, applyOptimistic] = useOptimistic(
    items,
    (current, change: { id: string; stock: number }) =>
      current.map((item) => (item.id === change.id ? { ...item, stock: change.stock } : item))
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (id: string, stock: number) => {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id, stock });
      const result = await updateProductStockAction(id, stock);
      if (!result.ok) setError(result.message);
    });
  };

  return { items: optimistic, pending, error, dismissError: () => setError(null), save };
}
