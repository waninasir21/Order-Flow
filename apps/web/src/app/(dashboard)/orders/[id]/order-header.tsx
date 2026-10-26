"use client";

import { OrderActions } from "@/components/order-actions";
import { StatusBadge } from "@/components/status-badge";
import type { OrderStatus } from "@/lib/queries";
import { useOrderStatusChange } from "../use-order-status";

// The order page's title row: id, live status badge and the approve / reject buttons. It is a
// client component because the optimistic status has to drive both the badge and the buttons.
export function OrderHeader({ orderId, title, status }: { orderId: string; title: string; status: OrderStatus }) {
  const { items, pending, error, dismissError, change } = useOrderStatusChange([{ id: orderId, status }]);
  const current = items[0]?.status ?? status;

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{title}</h1>
          <StatusBadge status={current} />
        </div>
        <OrderActions status={current} disabled={pending} onChange={(to) => change(orderId, to)} />
      </div>
      {error ? <ErrorBanner message={error} onDismiss={dismissError} /> : null}
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <p
      role="alert"
      className="mt-3 flex items-start justify-between gap-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="font-semibold underline">
        Dismiss
      </button>
    </p>
  );
}
