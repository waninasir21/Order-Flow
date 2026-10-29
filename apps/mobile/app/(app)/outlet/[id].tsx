import { useQuery } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { OrderRow } from "@/components/OrderRow";
import { PendingOrderCard } from "@/components/PendingOrderCard";
import { Button, Card, EmptyState, ErrorState, Loading } from "@/components/ui";
import { OUTLETS } from "@/graphql/operations";
import type { Outlet } from "@/graphql/types";
import { useOrdersFeed } from "@/hooks/useOrdersFeed";
import { describeError } from "@/lib/errors";
import { useThemedStyles } from "@/theme/useTheme";
import type { Palette } from "@/theme/tokens";

export default function OutletDetailScreen() {
  const styles = useThemedStyles(createStyles);
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
  if (!outlet) return <EmptyState
        title="Outlet not available"
        message="This outlet isn't assigned to you, or it no longer exists."
        action={{ label: "Back to outlets", onPress: () => router.replace("/") }}
      />;

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
          <Text style={styles.muted}>No orders for this outlet yet. Tap “Place order” to create the first one.</Text>
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

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 4 },
  muted: { color: colors.muted, marginTop: 2, fontSize: 14 },
  heading: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 8 },
  empty: { paddingVertical: 12 },
  });
