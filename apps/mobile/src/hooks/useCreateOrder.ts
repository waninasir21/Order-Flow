import { useMutation } from "@apollo/client";
import type { Reference, StoreObject } from "@apollo/client";
import { CREATE_ORDER } from "@/graphql/operations";
import type { Order, OrderItemInput } from "@/graphql/types";

interface CreateOrderData {
  createOrder: Order;
}

// The ONE place the createOrder mutation is called. Week 4 swaps the network
// call in here for an offline queue, so screens must never call it directly.
export function useCreateOrder() {
  const [mutate, state] = useMutation<CreateOrderData>(CREATE_ORDER, {
    update(cache, { data }) {
      const created = data?.createOrder;
      if (!created) return;

      // The cached Orders list gets the new order on top, with no network round trip.
      // The app only ever uses the unfiltered `orders` field (per-outlet views filter
      // client-side), so exactly one cached list needs updating. Any filtered variant
      // added later (orders(status: ...)) is skipped by the check below on purpose.
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
    },
    // Stock changed on the server, so the product list is refetched rather than
    // patched by hand: the server is the source of truth for stock.
    refetchQueries: ["Products"],
  });

  const createOrder = (outletId: string, items: OrderItemInput[]) =>
    mutate({ variables: { outletId, items } });

  return { createOrder, ...state };
}
