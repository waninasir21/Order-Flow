"use client";

import { useState } from "react";
import { ORDER_ACTIONS } from "@/lib/transitions";
import type { OrderStatus } from "@/lib/queries";

// Buttons for the moves the state machine allows from `status`; nothing else is rendered, so an
// already-fulfilled order has no Approve button to click.
export function OrderActions({
  status,
  disabled,
  onChange,
  orderLabel,
}: {
  status: OrderStatus;
  disabled: boolean;
  onChange: (to: OrderStatus) => void;
  // e.g. "#A1B2C3". Screen readers list buttons out of context, so "Approve" alone, repeated
  // on every row, doesn't say which order it acts on.
  orderLabel?: string;
}) {
  const named = (label: string) => (orderLabel ? `${label} order ${orderLabel}` : label);
  const [confirming, setConfirming] = useState(false);
  const actions = ORDER_ACTIONS[status];

  if (actions.length === 0) return <span className="text-xs text-muted">No further actions</span>;

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm rejection">
        <span className="text-xs text-muted">Reject and return stock?</span>
        <button
          type="button"
          disabled={disabled}
          aria-label={named("Yes, reject")}
          onClick={() => {
            setConfirming(false);
            onChange("REJECTED");
          }}
          className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-surface disabled:opacity-50"
        >
          Yes, reject
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          aria-label={named("Cancel rejecting")}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-bg"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a.to}
          type="button"
          disabled={disabled}
          aria-label={named(a.label)}
          onClick={() => (a.confirm ? setConfirming(true) : onChange(a.to))}
          className={
            a.tone === "primary"
              ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50"
              : "rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
          }
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
