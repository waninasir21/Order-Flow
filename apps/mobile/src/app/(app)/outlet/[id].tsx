import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@apollo/client/react";
import { PRODUCTS, type Product } from "@/lib/graphql";
import { useCreateOrder } from "@/hooks/useCreateOrder";

export default function PlaceOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useQuery<{ products: Product[] }>(PRODUCTS, {
    fetchPolicy: "cache-and-network", // stock changes after every order
  });
  const { createOrder, loading: placing } = useCreateOrder();
  // Cart is screen-local: it's only used on this screen. See DECISIONS.md note below.
  const [qty, setQty] = useState<Record<string, number>>({});

  const items = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [qty],
  );
  const total = useMemo(
    () =>
      (data?.products ?? []).reduce(
        (s, p) => s + p.price * (qty[p.id] ?? 0),
        0,
      ),
    [data, qty],
  );

  const step = (p: Product, d: number) =>
    setQty((q) => ({
      ...q,
      [p.id]: Math.max(0, Math.min(p.stockQuantity, (q[p.id] ?? 0) + d)),
    }));

  const submit = async () => {
    try {
      await createOrder(id, items);
      Alert.alert("Order placed", "Your order was created.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(
        "Couldn't place order",
        e instanceof Error ? e.message : "Unknown error",
      );
    }
  };

  if (loading && !data) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data?.products ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderColor: "#ddd",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }}>{item.name}</Text>
              <Text>
                ₹{item.price} · {item.stockQuantity} in stock
              </Text>
            </View>
            <Button title="−" onPress={() => step(item, -1)} />
            <Text style={{ width: 32, textAlign: "center" }}>
              {qty[item.id] ?? 0}
            </Text>
            <Button title="+" onPress={() => step(item, 1)} />
          </View>
        )}
      />
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 16 }}>Total: ₹{total.toFixed(2)}</Text>
        <Button
          title={placing ? "Placing…" : "Place order"}
          onPress={submit}
          disabled={placing || items.length === 0}
        />
      </View>
    </View>
  );
}
