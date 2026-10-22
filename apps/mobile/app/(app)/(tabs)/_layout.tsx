import { Tabs } from "expo-router";
import { Alert, Pressable, Text } from "react-native";
import { colors } from "@/components/ui";
import { signOut } from "@/lib/session";
import { useAuthStore } from "@/stores/auth";

function LogoutButton() {
  const confirm = () =>
    Alert.alert("Sign out", "Log out of OrderFlow?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  return (
    <Pressable onPress={confirm} hitSlop={8} style={{ paddingHorizontal: 16 }}>
      <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign out</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const name = useAuthStore((s) => s.employee?.name);
  return (
    <Tabs screenOptions={{ headerRight: () => <LogoutButton />, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: name ? `Outlets · ${name}` : "Outlets", tabBarLabel: "Outlets" }} />
      <Tabs.Screen name="orders" options={{ title: "My orders", tabBarLabel: "Orders" }} />
    </Tabs>
  );
}
