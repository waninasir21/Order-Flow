import { useQuery } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, EmptyState, ErrorState, Loading, colors } from "@/components/ui";
import { PRODUCTS } from "@/graphql/operations";
import type { Product } from "@/graphql/types";
import { useCreateOrder } from "@/hooks/useCreateOrder";
import { describeError, errorCode, formatMoney } from "@/lib/errors";

export default function PlaceOrderScreen() {
  const { outletId } = useLocalSearchParams<{ outletId: string }>();
  const router = useRouter();

  // Stock must be fresh when picking quantities, so always confirm with the server.
  const { data, loading, error, refetch } = useQuery<{ products: Product[] }>(PRODUCTS, {
    fetchPolicy: "cache-and-network",
  });
  const { createOrder, loading: submitting } = useCreateOrder();

  // Cart = component-local state: it's only used on this screen and should vanish when
  // the screen closes. (A Zustand cart would only be worth it if several screens shared it.)
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const products = data?.products ?? [];

  const { lineCount, total } = useMemo(() => {
    let sum = 0;
    let lines = 0;
    for (const p of products) {
      const q = quantities[p.id] ?? 0;
      if (q > 0) {
        lines += 1;
        sum += q * p.price;
      }
    }
    return { lineCount: lines, total: sum };
  }, [products, quantities]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={describeError(error)} onRetry={() => void refetch()} />;

  const change = (product: Product, delta: number) => {
    setQuantities((prev) => {
      const next = Math.min(product.stockQuantity, Math.max(0, (prev[product.id] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[product.id];
      else copy[product.id] = next;
      return copy;
    });
  };

  const submit = async () => {
    const items = Object.entries(quantities).map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0 || !outletId) return;
    try {
      await createOrder(outletId, items);
      Alert.alert("Order placed", "Your order was sent for approval.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Couldn't place order", describeError(e));
      if (errorCode(e) === "INSUFFICIENT_STOCK") {
        // Someone else took the stock: reload it and cap the cart to what's really left.
        const fresh = await refetch();
        const latest = fresh.data?.products ?? [];
        setQuantities((prev) => {
          const copy: Record<string, number> = {};
          for (const [id, q] of Object.entries(prev)) {
            const available = latest.find((p) => p.id === id)?.stockQuantity ?? 0;
            const capped = Math.min(q, available);
            if (capped > 0) copy[id] = capped;
          }
          return copy;
        });
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={products}
        keyExtractor={(p) => p.id}
        ListEmptyComponent={<EmptyState message="No products available." />}
        renderItem={({ item }) => {
          const qty = quantities[item.id] ?? 0;
          const soldOut = item.stockQuantity === 0;
          return (
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.muted}>
                  {formatMoney(item.price)} · {soldOut ? "Out of stock" : `${item.stockQuantity} in stock`}
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepBtn, qty === 0 && styles.stepDisabled]}
                  onPress={() => change(item, -1)}
                  disabled={qty === 0}
                >
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.qty}>{qty}</Text>
                <Pressable
                  style={[styles.stepBtn, (soldOut || qty >= item.stockQuantity) && styles.stepDisabled]}
                  onPress={() => change(item, 1)}
                  disabled={soldOut || qty >= item.stockQuantity}
                >
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.footer}>
        <Text style={styles.total}>
          {lineCount} product{lineCount === 1 ? "" : "s"} · {formatMoney(total)}
        </Text>
        <Button title="Place order" onPress={submit} loading={submitting} disabled={lineCount === 0} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  content: { padding: 16, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDisabled: { opacity: 0.3 },
  stepText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 22 },
  qty: { minWidth: 22, textAlign: "center", fontSize: 16, fontWeight: "600" },
  footer: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  total: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
});
