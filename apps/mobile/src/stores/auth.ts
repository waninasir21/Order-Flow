import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "@/lib/secureStorage";

export type Role = "REP" | "ADMIN";

export interface Employee {
  id: string;
  name: string;
  role: Role;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  employee: Employee | null;
  // False until the persisted session has been read from SecureStore (async).
  // Route guards must wait for this, or they'd flash the login screen on every launch.
  hydrated: boolean;
  setSession: (s: { accessToken: string; refreshToken: string; employee: Employee }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      employee: null,
      hydrated: false,
      setSession: ({ accessToken, refreshToken, employee }) =>
        set({ accessToken, refreshToken, employee }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null, employee: null }),
    }),
    {
      name: "orderflow-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        employee: s.employee,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hydrated: true });
      },
    }
  )
);
