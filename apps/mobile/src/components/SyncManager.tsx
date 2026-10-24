import { useEffect } from "react";
import { AppState } from "react-native";
import { startNetworkMonitoring, useNetworkStore } from "@/offline/network";
import { useOutbox } from "@/offline/outbox";
import { syncOutbox } from "@/offline/sync";

// Renders nothing. Mounted inside the signed-in part of the app, so it only runs when
// there is a session to send orders with. Sync is triggered by:
//   1. launch (also recovers orders left SYNCING by a killed app),
//   2. the phone going from offline to online,
//   3. the app returning to the foreground.
// Failed sends also reschedule themselves (see scheduleSync in offline/sync.ts).
export function SyncManager() {
  useEffect(() => {
    startNetworkMonitoring();

    let cancelled = false;
    useOutbox
      .getState()
      .load()
      .then(() => {
        if (!cancelled) void syncOutbox();
      })
      .catch((e) => console.warn("Could not open the offline queue", e));

    const unsubscribeNetwork = useNetworkStore.subscribe((state, prev) => {
      if (state.online && !prev.online) void syncOutbox();
    });
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") void syncOutbox();
    });

    return () => {
      cancelled = true;
      unsubscribeNetwork();
      appState.remove();
    };
  }, []);

  return null;
}
