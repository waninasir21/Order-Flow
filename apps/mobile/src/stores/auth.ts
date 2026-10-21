import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { storage, tokens } from "@/lib/storage";

export type Employee = { id: string; name: string; role: "REP" | "ADMIN" };

type AuthState = {
  employee: Employee | null;
  signIn: (
    employee: Employee,
    accessToken: string,
    refreshToken: string,
  ) => void;
  signOut: () => void;
};

// MMKV is synchronous, so the store hydrates before first render:
// no loading state is needed in the route guard.
const mmkvStorage = createJSONStorage(() => ({
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => {
    storage.remove(key);
  },
}));

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      employee: null,
      signIn: (employee, accessToken, refreshToken) => {
        tokens.set(accessToken, refreshToken);
        set({ employee });
      },
      signOut: () => {
        tokens.clear();
        set({ employee: null });
      },
    }),
    { name: "auth", storage: mmkvStorage },
  ),
);
