import { useMutation } from "@apollo/client/react";
import { CREATE_ORDER, type Order } from "@/lib/graphql";

type Vars = {
  outletId: string;
  items: { productId: string; quantity: number }[];
};

export function useCreateOrder() {
  const [mutate, { loading }] = useMutation<{ createOrder: Order }, Vars>(
    CREATE_ORDER,
    {
      update(cache, { data }) {
        const order = data?.createOrder;
        if (!order) return;
        // Prepend the new order to every cached `orders` list, no refetch needed.
        cache.modify({
          fields: {
            orders(existing = [], { toReference }) {
              const ref = toReference(order);
              return ref ? [ref, ...existing] : existing;
            },
          },
        });
      },
    },
  );

  const createOrder = (outletId: string, items: Vars["items"]) =>
    mutate({ variables: { outletId, items } });

  return { createOrder, loading };
}
