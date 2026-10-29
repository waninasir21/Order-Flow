import { StyleSheet, Text, View } from "react-native";
import type { Order, OrderStatus } from "@/graphql/types";
import { formatMoney } from "@/lib/errors";
import { useTheme, useThemedStyles } from "@/theme/useTheme";
import type { Palette } from "@/theme/tokens";
import { Card } from "./ui";

const LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  APPROVED: "Approved",
  FULFILLED: "Fulfilled",
  REJECTED: "Rejected",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const c = colors.status[status];
  return (
    <View
      style={[styles.badge, { backgroundColor: c.bg }]}
      accessible
      accessibilityLabel={`Status: ${LABEL[status]}`}
    >
      <Text style={[styles.badgeText, { color: c.fg }]}>{status}</Text>
    </View>
  );
}

export function OrderRow({ order, showOutlet = true }: { order: Order; showOutlet?: boolean }) {
  const styles = useThemedStyles(createStyles);
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

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "600", color: colors.text, flexShrink: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  items: { color: colors.text, marginTop: 8, fontSize: 14 },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, gap: 8 },
  muted: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  total: { fontWeight: "700", color: colors.text },
  });
