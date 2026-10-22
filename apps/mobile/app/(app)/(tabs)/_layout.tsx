import { Tabs } from "expo-router";
import { Alert, Pressable, Text } from "react-native";
import { colors } from "@/components/ui";
import { signOut } from "@/lib/session";
import { useOutbox } from "@/offline/outbox";
import { useAuthStore } from "@/stores/auth";

// Orders saved on this phone that the server doesn't have yet (queued, syncing or failed).
function useUnsyncedCount() {
  const employeeId = useAuthStore((s) => s.employee?.id);
  return useOutbox((s) => s.rows.filter((r) => r.employeeId === employeeId).length);
}

function LogoutButton() {
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
    <Pressable onPress={confirm} hitSlop={8} style={{ paddingHorizontal: 16 }}>
      <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign out</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const name = useAuthStore((s) => s.employee?.name);
  const unsynced = useUnsyncedCount();
  return (
    <Tabs screenOptions={{ headerRight: () => <LogoutButton />, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: name ? `Outlets · ${name}` : "Outlets", tabBarLabel: "Outlets" }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: "My orders",
          tabBarLabel: "Orders",
          tabBarBadge: unsynced > 0 ? unsynced : undefined, // how many are waiting to sync
        }}
      />
    </Tabs>
  );
}
