import { Redirect, Stack } from "expo-router";
import { Loading } from "@/components/ui";
import { useAuthStore } from "@/stores/auth";

// Layout-level auth guard: every screen inside (app)/ is protected by this one check.
export default function AppLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const signedIn = useAuthStore((s) => !!s.refreshToken && !!s.employee);

  // Wait for the persisted session to load, or logged-in users would see /login flash on launch.
  if (!hydrated) return <Loading />;
  if (!signedIn) return <Redirect href="/login" />;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="outlet/[id]" options={{ title: "Outlet" }} />
      <Stack.Screen name="place-order/[outletId]" options={{ title: "Place order" }} />
    </Stack>
  );
}
