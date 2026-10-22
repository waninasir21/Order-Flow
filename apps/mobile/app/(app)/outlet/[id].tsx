import { useQuery } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { OrderRow } from "@/components/OrderRow";
import { Button, Card, EmptyState, ErrorState, Loading, colors } from "@/components/ui";
import { ORDERS, OUTLETS } from "@/graphql/operations";
import type { Order, Outlet } from "@/graphql/types";
import { describeError } from "@/lib/errors";

export default function OutletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Both queries are already cached from the list screens, so this renders instantly.
  const outlets = useQuery<{ outlets: Outlet[] }>(OUTLETS);
  const orders = useQuery<{ orders: Order[] }>(ORDERS, { fetchPolicy: "cache-and-network" });

  if (outlets.loading && !outlets.data) return <Loading />;
  if (outlets.error && !outlets.data) {
    return <ErrorState message={describeError(outlets.error)} onRetry={() => void outlets.refetch()} />;
  }

  const outlet = outlets.data?.outlets.find((o) => o.id === id);
  if (!outlet) return <EmptyState message="This outlet isn't available to you." />;

  // Filtered on the device from the one cached list, so a freshly placed order shows up
  // here immediately. Fine for a rep's own orders; a server-side filter (the `outletId`
  // argument) would be the move if lists got large.
  const outletOrders = (orders.data?.orders ?? []).filter((o) => o.outlet.id === outlet.id);

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
      {orders.loading && !orders.data ? (
        <Loading />
      ) : outletOrders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.muted}>No orders yet.</Text>
        </View>
      ) : (
        outletOrders.map((o) => <OrderRow key={o.id} order={o} showOutlet={false} />)
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
