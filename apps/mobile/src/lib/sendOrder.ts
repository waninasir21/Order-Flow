import { apolloClient } from "@/apollo/client";
import { addOrderToCache } from "@/apollo/orderCache";
import { CREATE_ORDER } from "@/graphql/operations";
import type { Order, OrderItemInput } from "@/graphql/types";

const TIMEOUT_MS = 15_000;

export interface SendOrderInput {
  clientId: string; // idempotency key: the same clientId always yields the same server order
  outletId: string;
  items: OrderItemInput[];
}

// The ONE function that calls the createOrder mutation. It is used by the online path in
// useCreateOrder() and by the sync manager, so both behave identically.
export async function sendCreateOrder(input: SendOrderInput): Promise<Order> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // A phone on Wi-Fi with a dead backend would otherwise wait a very long time. A timeout
  // counts as a network failure, so the order is queued. If the server did process it,
  // the retry with the same clientId returns the existing order.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("The request timed out"), { isTimeout: true }));
    }, TIMEOUT_MS);
  });

  const request = apolloClient.mutate<{ createOrder: Order }>({
    mutation: CREATE_ORDER,
    variables: input,
    context: { fetchOptions: { signal: controller.signal } },
    update(cache, { data }) {
      if (data?.createOrder) addOrderToCache(cache, data.createOrder);
      // Stock changed on the server. Evicting the cached products makes any screen showing
      // them refetch; the server is the source of truth for stock.
      cache.evict({ id: "ROOT_QUERY", fieldName: "products" });
    },
  });

  try {
    const result = await Promise.race([request, timeout]);
    const order = result.data?.createOrder;
    if (!order) throw new Error("The server returned no order");
    return order;
  } finally {
    clearTimeout(timer);
  }
}
