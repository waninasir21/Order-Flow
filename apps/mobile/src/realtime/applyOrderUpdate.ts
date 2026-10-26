import type { ApolloCache } from "@apollo/client";
import { addOrderToCache } from "@/apollo/orderCache";
import { ORDER_FIELDS } from "@/graphql/operations";
import type { Order } from "@/graphql/types";

// Writes an order that arrived over the socket straight into the Apollo cache. Every screen
// reading that order re-renders on its own; nothing is refetched.
//
// Returns false (and writes nothing) when the cached copy already has this status. That
// dedupes the cases where the same change reaches us twice: an event racing the catch-up
// refetch after a reconnect, or a replayed event. The caller must not notify for those.
export function applyOrderUpdate(cache: ApolloCache<unknown>, order: Order): boolean {
  const id = cache.identify({ __typename: "Order", id: order.id });

  if (id) {
    const cached = cache.readFragment<Pick<Order, "status">>({ id, fragment: ORDER_FIELDS });
    if (cached && cached.status === order.status) return false;
  }

  cache.writeFragment({ id, fragment: ORDER_FIELDS, data: { __typename: "Order", ...order } });
  // An order we hadn't loaded yet (e.g. placed from another device) joins the list.
  addOrderToCache(cache, order);
  return true;
}
