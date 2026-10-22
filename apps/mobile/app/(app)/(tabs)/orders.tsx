import { useQuery } from "@apollo/client";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet } from "react-native";
import { OrderRow } from "@/components/OrderRow";
import { EmptyState, ErrorState, Loading, colors } from "@/components/ui";
import { ORDERS } from "@/graphql/operations";
import type { Order } from "@/graphql/types";
import { describeError } from "@/lib/errors";

export default function OrdersScreen() {
  // cache-and-network: show cached orders instantly, then confirm with the server.
  const { data, loading, error, refetch } = useQuery<{ orders: Order[] }>(ORDERS, {
    fetchPolicy: "cache-and-network",
  });
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={describeError(error)} onRetry={() => void refetch()} />;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={data?.orders ?? []}
      keyExtractor={(o) => o.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState message="No orders yet. Open an outlet to place one." />}
      renderItem={({ item }) => <OrderRow order={item} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, flexGrow: 1 },
});
