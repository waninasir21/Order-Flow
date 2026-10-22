import { useQuery } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { OrderRow } from "@/components/OrderRow";
import { PendingOrderCard } from "@/components/PendingOrderCard";
import { Button, Card, EmptyState, ErrorState, Loading, colors } from "@/components/ui";
import { OUTLETS } from "@/graphql/operations";
import type { Outlet } from "@/graphql/types";
import { useOrdersFeed } from "@/hooks/useOrdersFeed";
import { describeError } from "@/lib/errors";

export default function OutletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Both are already cached from the list screens, so this renders instantly.
  const outlets = useQuery<{ outlets: Outlet[] }>(OUTLETS);
  // This outlet's orders: queued ones from the phone first, then the server's.
  const { items: outletOrders, query: orders } = useOrdersFeed(id);

  if (outlets.loading && !outlets.data) return <Loading />;
  if (outlets.error && !outlets.data) {
    return <ErrorState message={describeError(outlets.error)} onRetry={() => void outlets.refetch()} />;
  }

  const outlet = outlets.data?.outlets.find((o) => o.id === id);
  if (!outlet) return <EmptyState message="This outlet isn't available to you." />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.name}>{outlet.name}</Text>
        <Text style={styles.muted}>{outlet.address}</Text>
        <Text style={styles.muted}>Owner: {outlet.ownerName}</Text>
        <Text style={styles.muted}>Phone: {outlet.phone}</Text>
      </Card>

      <Button title="Place order" onPress={() => router.push(`/place-order/${outlet.id}`)} />

      <Text style={styles.heading}>Orders for this outlet</Text>
      {orders.loading && !orders.data && outletOrders.length === 0 ? (
        <Loading />
      ) : outletOrders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.muted}>No orders yet.</Text>
        </View>
      ) : (
        outletOrders.map((item) =>
          item.kind === "pending" ? (
            <PendingOrderCard key={item.key} pending={item.pending} showOutlet={false} />
          ) : (
            <OrderRow key={item.key} order={item.order} showOutlet={false} />
          )
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 4 },
  muted: { color: colors.muted, marginTop: 2, fontSize: 14 },
  heading: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 8 },
  empty: { paddingVertical: 12 },
});
