// Keep the token store in memory: the real one talks to the OS keychain (expo-secure-store).
jest.mock("@/lib/secureStorage", () => {
  const data = new Map<string, string>();
  return {
    secureStorage: {
      getItem: (k: string) => Promise.resolve(data.get(k) ?? null),
      setItem: (k: string, v: string) => {
        data.set(k, v);
        return Promise.resolve();
      },
      removeItem: (k: string) => {
        data.delete(k);
        return Promise.resolve();
      },
    },
  };
});
