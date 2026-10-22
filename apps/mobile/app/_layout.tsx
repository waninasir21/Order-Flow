import { ApolloProvider } from "@apollo/client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { apolloClient } from "@/apollo/client";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ApolloProvider client={apolloClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </ApolloProvider>
    </SafeAreaProvider>
  );
}
