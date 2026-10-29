import { Alert, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "@/lib/errors";
import { useOutbox, type PendingOrder, type SyncStatus } from "@/offline/outbox";
import { syncOutbox } from "@/offline/sync";
import { Button, Card } from "./ui";
import { useThemedStyles, useTheme } from "@/theme/useTheme";
import type { Palette } from "@/theme/tokens";

const LABELS: Record<SyncStatus, string> = {
  PENDING: "Waiting to sync",
  SYNCING: "Syncing…",
  FAILED: "Sync failed",
};

// An order that lives only on this phone so far. Three states, matching the doc:
// pending (can still be cancelled), syncing, and failed (shows why, with Retry / Discard).
export function PendingOrderCard({
  pending,
  showOutlet = true,
}: {
  pending: PendingOrder;
  showOutlet?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors: theme } = useTheme();
  const badge = {
    label: LABELS[pending.syncStatus],
    // Same colors as the order statuses: neutral while waiting, blue while sending, red on failure.
    ...(pending.syncStatus === "PENDING"
      ? { bg: theme.border, fg: theme.text }
      : pending.syncStatus === "SYNCING"
        ? theme.status.APPROVED
        : theme.status.REJECTED),
  };
  const itemCount = pending.items.reduce((n, i) => n + i.quantity, 0);

  const retry = async () => {
    await useOutbox.getState().setStatus(pending.id, "PENDING");
    void syncOutbox();
  };

  const remove = (title: string, message: string, confirm: string) =>
    Alert.alert(title, message, [
      { text: "Keep it", style: "cancel" },
      {
        text: confirm,
        style: "destructive",
        onPress: () => {
          // Re-check: the sync loop may have picked this order up since the card rendered.
          const current = useOutbox.getState().rows.find((r) => r.id === pending.id);
          if (current && current.syncStatus !== "SYNCING") {
            void useOutbox.getState().remove(pending.id);
          }
        },
      },
    ]);

  return (
    <Card>
      <View style={styles.top}>
        <Text style={styles.title}>{showOutlet ? pending.outletName : "Order on this phone"}</Text>
        <View
          style={[styles.badge, { backgroundColor: badge.bg }]}
          accessible
          accessibilityLabel={`Sync status: ${badge.label}`}
        >
          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
      </View>

      <Text style={styles.items} numberOfLines={2}>
        {pending.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
      </Text>
      <View style={styles.bottom}>
        <Text style={styles.muted}>
          {itemCount} item{itemCount === 1 ? "" : "s"} · {new Date(pending.createdAt).toLocaleString()}
        </Text>
        <Text style={styles.total}>{formatMoney(pending.total)}</Text>
      </View>

      {pending.syncStatus === "PENDING" ? (
        <>
          <Text style={styles.note}>Saved on this phone. It will be sent when you&apos;re back online.</Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                title="Cancel order"
                variant="secondary"
                onPress={() =>
                  remove("Cancel this order?", "It hasn't been sent yet and will be deleted.", "Cancel order")
                }
              />
            </View>
          </View>
        </>
      ) : null}

      {pending.syncStatus === "FAILED" ? (
        <>
          <Text style={styles.error}>{pending.errorMessage ?? "The server could not accept this order."}</Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button title="Retry" onPress={() => void retry()} />
            </View>
            <View style={styles.action}>
              <Button
                title="Discard"
                variant="secondary"
                onPress={() =>
                  remove("Discard this order?", "It was never accepted by the server and will be deleted.", "Discard")
                }
              />
            </View>
          </View>
        </>
      ) : null}
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
  note: { color: colors.muted, fontSize: 13, marginTop: 10 },
  error: { color: colors.danger, fontSize: 14, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  action: { flex: 1 },
  });
