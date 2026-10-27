import { StyleSheet, Text, View } from "react-native";
import type { Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/useTheme";
import { Button } from "./ui";

// What the person sees instead of a red error screen or a blank app when a screen crashes.
// Shared by the route-level boundary (expo-router) and the whole-app boundary below it.
export function CrashScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.screen} accessibilityRole="alert">
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        The app hit an unexpected problem. Your session and any orders saved on this phone are safe.
      </Text>
      {__DEV__ ? <Text style={styles.detail}>{error.message}</Text> : null}
      <View style={styles.action}>
        <Button title="Try again" onPress={onRetry} />
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12, backgroundColor: colors.bg },
    title: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" },
    body: { fontSize: 15, color: colors.muted, textAlign: "center" },
    detail: { fontSize: 12, color: colors.danger, textAlign: "center", fontFamily: "monospace" },
    action: { alignSelf: "stretch", marginTop: 8 },
  });
