import type { OrderStatus } from "@prisma/client";

/*
 * Order status state machine
 *
 *   PLACED ──► APPROVED ──► FULFILLED
 *     │
 *     └──────► REJECTED   (stock is returned when an order is rejected)
 *
 * REJECTED and FULFILLED are terminal. Admin-only; enforced in the order service.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["APPROVED", "REJECTED"],
  APPROVED: ["FULFILLED"],
  REJECTED: [],
  FULFILLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
