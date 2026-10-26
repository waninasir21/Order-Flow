import { withFilter } from "graphql-subscriptions";
import { requireAuth } from "../auth/guards";
import type { Context } from "../context";
import { ORDER_STATUS_CHANGED, pubsub, type OrderStatusChangedPayload } from "../pubsub";

const filtered = withFilter<OrderStatusChangedPayload, { outletId?: string | null }, Context>(
  () => pubsub.asyncIterableIterator<OrderStatusChangedPayload>(ORDER_STATUS_CHANGED),
  (payload, args, ctx) => {
    const auth = ctx?.auth;
    if (!auth || !payload) return false;
    // Backstop for the server's expiry timer: never deliver on an expired token.
    if (auth.exp !== undefined && auth.exp * 1000 <= Date.now()) return false;

    const order = payload.orderStatusChanged;
    // Same visibility rule as the orders query: reps only ever see their own orders.
    if (auth.role === "REP" && order.employeeId !== auth.employeeId) return false;
    if (args?.outletId && order.outletId !== args.outletId) return false;
    return true;
  }
);

export const subscriptions = {
  orderStatusChanged: {
    subscribe: (
      root: OrderStatusChangedPayload,
      args: { outletId?: string | null },
      ctx: Context,
      info: unknown
    ) => {
      // Rejects anonymous subscribers with UNAUTHENTICATED before any stream is created.
      requireAuth(ctx);
      return filtered(root, args, ctx, info as never);
    },
  },
};
