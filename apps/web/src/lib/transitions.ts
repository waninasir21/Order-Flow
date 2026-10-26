import type { OrderStatus } from "./queries";

// What the dashboard offers for each status. This mirrors ALLOWED_TRANSITIONS in
// apps/backend/src/orderStatus.ts (PLACED -> APPROVED | REJECTED, APPROVED -> FULFILLED).
// The backend is still the authority and rejects anything else; this copy only decides which
// buttons to show. It moves to packages/shared-types when that package is created.
export interface OrderAction {
  to: OrderStatus;
  label: string;
  tone: "primary" | "danger";
  // Rejecting restocks the items and cannot be undone, so it asks first.
  confirm?: boolean;
}

export const ORDER_ACTIONS: Record<OrderStatus, OrderAction[]> = {
  PLACED: [
    { to: "APPROVED", label: "Approve", tone: "primary" },
    { to: "REJECTED", label: "Reject", tone: "danger", confirm: true },
  ],
  APPROVED: [{ to: "FULFILLED", label: "Mark fulfilled", tone: "primary" }],
  REJECTED: [],
  FULFILLED: [],
};
