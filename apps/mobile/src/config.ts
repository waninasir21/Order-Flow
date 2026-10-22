import Constants from "expo-constants";

// A phone can't reach the laptop via "localhost". In dev, Expo already knows the
// laptop's LAN IP (hostUri = "192.168.x.x:8081"), so reuse that host for the API.
// Override with EXPO_PUBLIC_API_URL for tunnel mode or a deployed backend.
function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:4000/graphql`;

  return "http://localhost:4000/graphql";
}

export const API_URL = resolveApiUrl();
