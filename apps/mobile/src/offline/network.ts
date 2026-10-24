import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

interface NetworkState {
  online: boolean;
}

// Starts optimistic: "unknown" must not block orders. We only say offline when the phone
// itself reports no connection (airplane mode, no Wi-Fi/mobile data).
// We deliberately ignore NetInfo's isInternetReachable: it pings a public server, which
// would wrongly read as offline on a LAN-only dev setup. A reachable-looking network whose
// backend is actually down is handled separately, by falling back to the queue when a
// request fails without any response.
export const useNetworkStore = create<NetworkState>(() => ({ online: true }));

let started = false;

export function startNetworkMonitoring(): void {
  if (started) return;
  started = true;
  NetInfo.addEventListener((state) => {
    useNetworkStore.setState({ online: state.isConnected !== false });
  });
}

export function isOffline(): boolean {
  return !useNetworkStore.getState().online;
}
