import { PubSub } from "graphql-subscriptions";
import type { OrderWithRelations } from "./services/orders";

// In-memory PubSub: events live inside this one Node process. That is fine for a single
// instance, but a second instance would never see events published on the first, so a
// multi-instance deployment needs a shared broker (e.g. graphql-redis-subscriptions,
// which implements the same PubSub interface). See DECISIONS.md.
export const pubsub = new PubSub();

export const ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED";

// The payload key matches the subscription field name, so GraphQL's default resolver
// finds the order without a custom `resolve` function.
export interface OrderStatusChangedPayload {
  orderStatusChanged: OrderWithRelations;
}

export function publishOrderStatusChanged(order: OrderWithRelations): Promise<void> {
  const payload: OrderStatusChangedPayload = { orderStatusChanged: order };
  return pubsub.publish(ORDER_STATUS_CHANGED, payload);
}
