import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet } from "react-native";
import { OrderRow } from "@/components/OrderRow";
import { PendingOrderCard } from "@/components/PendingOrderCard";
import { EmptyState, ErrorState, Loading, colors } from "@/components/ui";
import { useOrdersFeed } from "@/hooks/useOrdersFeed";
import { describeError } from "@/lib/errors";

export default function OrdersScreen() {
  // Queued orders from the phone first, then the server's. See useOrdersFeed.
  const { items, query } = useOrdersFeed();
  const { data, loading, error, refetch } = query;
  const [refreshing, setRefreshing] = useState(false);

  if (loading && !data && items.length === 0) return <Loading />;
  // Offline with nothing to show at all. (Queued orders still show without a server list.)
  if (error && !data && items.length === 0) {
    return <ErrorState message={describeError(error)} onRetry={() => void refetch()} />;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch {
      // Offline: keep showing what we have.
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.key}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState message="No orders yet. Open an outlet to place one." />}
      renderItem={({ item }) =>
        item.kind === "pending" ? (
          <PendingOrderCard pending={item.pending} />
        ) : (
          <OrderRow order={item.order} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, flexGrow: 1 },
});
