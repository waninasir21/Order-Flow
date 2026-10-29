import type { OrderStatus } from "./queries";

// A fixed locale AND time zone, so the server render and the browser render produce identical
// text (a time zone that differs between server and browser would cause hydration mismatches).
const TZ = "Asia/Kolkata";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
const dateOnly = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: TZ });

export const formatMoney = (value: number) => money.format(value);
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
// "2026-10-26" -> "26 Oct". The backend sends calendar days that are already in the business
// time zone, so this formats them as plain dates (UTC) and never shifts them.
const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export const formatDay = (isoDay: string) => dayLabel.format(new Date(`${isoDay}T00:00:00Z`));

export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

// Same short id the mobile app shows (last six characters).
export const shortId = (id: string) => `#${id.slice(-6).toUpperCase()}`;

// Line totals in whole paise, so 3 × 142.50 never turns into 427.49999999999994.
export const lineTotal = (price: number, quantity: number) => (Math.round(price * 100) * quantity) / 100;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FULFILLED: "Fulfilled",
};

export const STATUSES: OrderStatus[] = ["PLACED", "APPROVED", "FULFILLED", "REJECTED"];

export const LOW_STOCK_THRESHOLD = 10;
