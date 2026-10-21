import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { useQuery } from "@apollo/client/react";
import { ORDERS, type Order, type OrderStatus } from "@/lib/graphql";

const COLORS: Record<OrderStatus, string> = {
  PLACED: "#f59e0b",
  APPROVED: "#16a34a",
  REJECTED: "#dc2626",
  FULFILLED: "#2563eb",
};

export default function Orders() {
  const { data, loading, error, refetch } = useQuery<{ orders: Order[] }>(
    ORDERS,
    {
      fetchPolicy: "cache-and-network",
    },
  );

  if (loading && !data) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error) return <Text style={{ padding: 16 }}>Error: {error.message}</Text>;

  return (
    <FlatList
      data={data?.orders ?? []}
      keyExtractor={(o) => o.id}
      onRefresh={() => refetch()}
      refreshing={loading}
      ListEmptyComponent={<Text style={{ padding: 16 }}>No orders yet.</Text>}
      renderItem={({ item }) => (
        <View
          style={{
            padding: 16,
            borderBottomWidth: 1,
            borderColor: "#ddd",
            gap: 4,
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ fontWeight: "600" }}>{item.outlet.name}</Text>
            <Text
              style={{
                color: "#fff",
                backgroundColor: COLORS[item.status],
                paddingHorizontal: 8,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {item.status}
            </Text>
          </View>
          <Text>
            {item.items
              .map((i) => `${i.product.name} × ${i.quantity}`)
              .join(", ")}
          </Text>
          <Text>₹{item.total.toFixed(2)}</Text>
        </View>
      )}
    />
  );
}
