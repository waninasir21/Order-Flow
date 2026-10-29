import { ApolloProvider } from "@apollo/client";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { apolloClient } from "@/apollo/client";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { CrashScreen } from "@/components/CrashScreen";
import { useTheme } from "@/theme/useTheme";

// expo-router uses this component in place of any screen that throws while rendering.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} onRetry={() => void retry()} />;
}

// Headers, tab bars and screen backgrounds come from the navigation theme, so it has to carry
// the same palette as our own components or they would not match in dark mode.
function Navigation({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: colors.accent,
          background: colors.bg,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.accent,
        },
      }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ApolloProvider client={apolloClient}>
          <Navigation>
            <Stack screenOptions={{ headerShown: false }} />
          </Navigation>
        </ApolloProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
