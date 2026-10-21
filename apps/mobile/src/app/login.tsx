import { useState } from "react";
import { Alert, Button, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@apollo/client/react";
import { LOGIN, type LoginData } from "@/lib/graphql";
import { useAuth } from "@/stores/auth";

export default function Login() {
  const [phone, setPhone] = useState("9900000002"); // seeded rep; remove prefill later
  const [password, setPassword] = useState("password123");
  const [login, { loading }] = useMutation<
    LoginData,
    { phone: string; password: string }
  >(LOGIN);
  const signIn = useAuth((s) => s.signIn);

  const onSubmit = async () => {
    try {
      const res = await login({ variables: { phone, password } });
      const p = res.data?.login;
      if (!p) return;
      const { id, name, role } = p.employee;
      signIn({ id, name, role }, p.accessToken, p.refreshToken);
    } catch (e) {
      Alert.alert(
        "Login failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, padding: 24, gap: 12, justifyContent: "center" }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700" }}>OrderFlow</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone"
        keyboardType="phone-pad"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      <Button
        title={loading ? "Signing in…" : "Sign in"}
        onPress={onSubmit}
        disabled={loading}
      />
    </SafeAreaView>
  );
}
