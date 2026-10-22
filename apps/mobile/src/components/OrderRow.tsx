import { StyleSheet, Text, View } from "react-native";
import type { Order, OrderStatus } from "@/graphql/types";
import { formatMoney } from "@/lib/errors";
import { Card, colors } from "./ui";

const STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string }> = {
  PLACED: { bg: "#fef3c7", fg: "#92400e" },
  APPROVED: { bg: "#dbeafe", fg: "#1e40af" },
  FULFILLED: { bg: "#dcfce7", fg: "#166534" },
  REJECTED: { bg: "#fee2e2", fg: "#991b1b" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{status}</Text>
    </View>
  );
}

export function OrderRow({ order, showOutlet = true }: { order: Order; showOutlet?: boolean }) {
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <Card>
      <View style={styles.top}>
        <Text style={styles.title}>{showOutlet ? order.outlet.name : `Order ${order.id.slice(-6)}`}</Text>
        <StatusBadge status={order.status} />
      </View>
      <Text style={styles.items} numberOfLines={2}>
        {order.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ")}
      </Text>
      <View style={styles.bottom}>
        <Text style={styles.muted}>
          {itemCount} item{itemCount === 1 ? "" : "s"} · {new Date(order.createdAt).toLocaleString()}
        </Text>
        <Text style={styles.total}>{formatMoney(order.total)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "600", color: colors.text, flexShrink: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  items: { color: colors.text, marginTop: 8, fontSize: 14 },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, gap: 8 },
  muted: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  total: { fontWeight: "700", color: colors.text },
});
