import { Platform } from "react-native";
import type { Order } from "@/graphql/types";
import { formatMoney } from "@/lib/errors";

const CHANNEL_ID = "order-updates";

type NotificationsModule = typeof import("expo-notifications");

// expo-notifications is loaded on first use, inside try/catch, never at import time.
// Some Expo Go builds don't contain every native module the package references, and a
// top-level import would then throw while the app starts and take the whole app down
// (every screen, not just notifications). Loaded this way, the worst case is "no banner":
// the live badge update does not depend on it.
let cached: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === "web") return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-notifications") as NotificationsModule;
    // By default a notification that arrives while the app is open is silently dropped.
    // This makes it show as a banner anyway, which is the "rep is using the app" case.
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
  } catch (e) {
    // Message only, not the Error object: the dev overlay would render a whole stack trace
    // for something that is expected and harmless here.
    console.log(
      "[notifications] unavailable in this app build, continuing without them:",
      e instanceof Error ? e.message : String(e),
    );
    cached = null;
  }
  return cached;
}

// Asks once (the OS remembers the answer). Never throws: a rep who says no still gets the
// live badge change, just not the banner.
export async function setUpNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Order updates",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && current.canAskAgain)
      await Notifications.requestPermissionsAsync();
  } catch (e) {
    console.warn("Could not set up notifications", e);
  }
}

const VERB: Record<string, string> = {
  APPROVED: "approved",
  REJECTED: "rejected",
  FULFILLED: "fulfilled",
};

// A local notification: scheduled by this app on this phone, so it only appears while the
// app process is alive. (Reaching a closed app needs a server-sent push; see DECISIONS.md.)
export async function notifyStatusChange(order: Order): Promise<void> {
  const verb = VERB[order.status];
  const Notifications = getNotifications();
  if (!verb || !Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Order ${order.id.slice(-6).toUpperCase()} ${verb}`,
        body: `${order.outlet.name} · ${formatMoney(order.total)}`,
      },
      trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
    });
  } catch (e) {
    console.warn("Could not show notification", e);
  }
}
