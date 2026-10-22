import * as SecureStore from "expo-secure-store";
import type { StateStorage } from "zustand/middleware";

// Zustand persistence backed by the OS keychain/keystore (works in Expo Go).
// The architecture doc suggests MMKV, but react-native-mmkv needs a custom dev
// build and doesn't run in Expo Go. This is the only file to change if we switch:
// replace it with an MMKV-backed StateStorage.
// Note: SecureStore keys may only contain letters, digits, ".", "-" and "_".
export const secureStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};
