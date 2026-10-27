import { useMutation } from "@apollo/client";
import { Redirect } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { LOGIN } from "@/graphql/operations";
import type { LoginData } from "@/graphql/types";
import { describeError } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth";
import { useThemedStyles, useTheme } from "@/theme/useTheme";
import type { Palette } from "@/theme/tokens";

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors: theme } = useTheme();
  const hydrated = useAuthStore((s) => s.hydrated);
  const signedIn = useAuthStore((s) => !!s.refreshToken && !!s.employee);
  const setSession = useAuthStore((s) => s.setSession);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [login, { loading }] = useMutation<LoginData>(LOGIN);

  // Already logged in (e.g. app relaunch): skip straight to the app.
  if (hydrated && signedIn) return <Redirect href="/" />;

  const submit = async () => {
    setError(null);
    try {
      const result = await login({ variables: { phone: phone.trim(), password } });
      const payload = result.data?.login;
      if (!payload) return;
      // Persisted to SecureStore by the store; the redirect above then kicks in.
      setSession(payload);
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.title}>OrderFlow</Text>
        <Text style={styles.subtitle}>Sign in to place orders for your outlets</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor={theme.muted}
            accessibilityLabel="Phone number"
            textContentType="telephoneNumber"
            autoComplete="tel"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={theme.muted}
            accessibilityLabel="Password"
            textContentType="password"
            autoComplete="password"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button
            title="Sign in"
            onPress={submit}
            loading={loading}
            disabled={!phone.trim() || !password}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 32, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.muted, marginTop: 4, marginBottom: 28, fontSize: 15 },
  form: { gap: 12 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 14 },
  });
