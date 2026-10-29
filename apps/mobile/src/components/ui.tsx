import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, useThemedStyles } from "@/theme/useTheme";
import type { Palette } from "@/theme/tokens";

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Loading" />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

// A deliberate "nothing here yet" state: what this screen is for, and what to do next.
export function EmptyState({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.center}>
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      <Text style={styles.muted}>{message}</Text>
      {action ? <Button title={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        inactive && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.accent : colors.accentInk} />
      ) : (
        <Text style={[styles.buttonText, variant === "secondary" && styles.buttonTextSecondary]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.card}>{children}</View>;
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: c.bg },
    errorTitle: { color: c.text, fontSize: 17, fontWeight: "700", textAlign: "center" },
    errorText: { color: c.danger, textAlign: "center", fontSize: 15 },
    emptyTitle: { color: c.text, fontSize: 17, fontWeight: "700", textAlign: "center" },
    muted: { color: c.muted, textAlign: "center", fontSize: 15 },
    button: {
      backgroundColor: c.accent,
      minHeight: 48,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: c.accent },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: c.accentInk, fontSize: 16, fontWeight: "600" },
    buttonTextSecondary: { color: c.accent },
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
  });
