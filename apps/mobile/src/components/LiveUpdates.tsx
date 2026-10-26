import { useOrderUpdates } from "@/realtime/useOrderUpdates";

// Renders nothing. Mounted inside the signed-in part of the app (like SyncManager), so the
// live connection exists exactly while there is a session.
export function LiveUpdates() {
  useOrderUpdates();
  return null;
}
