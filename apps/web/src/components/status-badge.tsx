import { STATUS_LABEL } from "@/lib/format";
import type { OrderStatus } from "@/lib/queries";

// One badge for every screen. Week 6 reuses it for the live-updating status.
export function StatusBadge({ status }: { status: OrderStatus }) {
  const key = status.toLowerCase();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ background: `var(--${key}-bg)`, color: `var(--${key}-fg)` }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: "currentColor" }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
