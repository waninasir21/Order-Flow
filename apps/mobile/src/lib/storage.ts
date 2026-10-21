import { createMMKV } from "react-native-mmkv";

// MMKV v4 API: createMMKV(), and .remove() (not .delete()).
// TODO: add an encryptionKey (key kept in expo-secure-store) before shipping.
export const storage = createMMKV({ id: "app" });

export const tokens = {
  get access() {
    return storage.getString("accessToken");
  },
  get refresh() {
    return storage.getString("refreshToken");
  },
  set(access: string, refresh: string) {
    storage.set("accessToken", access);
    storage.set("refreshToken", refresh);
  },
  clear() {
    storage.remove("accessToken");
    storage.remove("refreshToken");
  },
};
