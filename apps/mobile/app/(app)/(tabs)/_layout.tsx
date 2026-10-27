import { Tabs } from "expo-router";
import { Alert, Pressable, Text } from "react-native";
import { signOut } from "@/lib/session";
import { useOutbox } from "@/offline/outbox";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/useTheme";

// Orders saved on this phone that the server doesn't have yet (queued, syncing or failed).
function useUnsyncedCount() {
  const employeeId = useAuthStore((s) => s.employee?.id);
  return useOutbox((s) => s.rows.filter((r) => r.employeeId === employeeId).length);
}

function LogoutButton() {
  const { colors } = useTheme();
  const unsynced = useUnsyncedCount();
  const confirm = () =>
    Alert.alert(
      "Sign out",
      unsynced > 0
        ? `${unsynced} order${unsynced === 1 ? " hasn't" : "s haven't"} reached the server yet. They stay on this phone and are sent the next time you sign in. Sign out anyway?`
        : "Log out of OrderFlow?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void signOut() },
      ]
    );
  return (
    <Pressable
      onPress={confirm}
      hitSlop={8}
      style={{ paddingHorizontal: 16, minHeight: 44, justifyContent: "center" }}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
    >
      <Text style={{ color: colors.accent, fontWeight: "600" }}>Sign out</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const name = useAuthStore((s) => s.employee?.name);
  const unsynced = useUnsyncedCount();
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerRight: () => <LogoutButton />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: name ? `Outlets · ${name}` : "Outlets", tabBarLabel: "Outlets" }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: "My orders",
          tabBarLabel: "Orders",
          tabBarBadge: unsynced > 0 ? unsynced : undefined, // how many are waiting to sync
          tabBarAccessibilityLabel:
            unsynced > 0 ? `Orders, ${unsynced} waiting to sync` : "Orders",
        }}
      />
    </Tabs>
  );
}
