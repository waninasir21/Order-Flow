import type { ApolloCache, Reference, StoreObject } from "@apollo/client";
import type { Order } from "@/graphql/types";

// Puts a newly created order at the top of the cached Orders list with no network round
// trip. The app only uses the unfiltered `orders` field (per-outlet views filter on the
// device), so exactly one cached list needs updating. A filtered variant such as
// orders(status: ...) is skipped on purpose.
export function addOrderToCache(cache: ApolloCache<unknown>, created: Order): void {
  cache.modify({
    fields: {
      orders(existing: Reference | readonly Reference[] = [], { toReference, storeFieldName }) {
        // Apollo types a cached field as "one reference or a list"; ours is always a list.
        if (storeFieldName !== "orders" || !Array.isArray(existing)) return existing;
        const list = existing as readonly Reference[];
        const ref = toReference(created as unknown as StoreObject);
        if (!ref || list.some((r) => r.__ref === ref.__ref)) return list;
        return [ref, ...list];
      },
    },
  });
}
