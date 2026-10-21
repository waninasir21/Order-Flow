import { Stack } from "expo-router";
import { ApolloProvider } from "@apollo/client/react";
import { client } from "@/lib/apollo";
import { useAuth } from "@/stores/auth";

export default function RootLayout() {
  const signedIn = useAuth((s) => !!s.employee);
  return (
    <ApolloProvider client={client}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </ApolloProvider>
  );
}
