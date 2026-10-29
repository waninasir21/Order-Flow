// Color tokens for the phone app. Same intent as the web dashboard's CSS variables (warm
// paper background, one deep-green accent, amber/blue/green/red order statuses), so the two
// apps look like siblings. Components never write a hex value; they read these through
// useTheme() / useThemedStyles().
import type { OrderStatus } from "@/graphql/types";

export interface Pair {
  bg: string;
  fg: string;
}

export interface Palette {
  bg: string; // screen background
  surface: string; // cards, inputs, bars
  text: string;
  muted: string;
  border: string;
  accent: string; // primary buttons, links, active tab
  accentInk: string; // text on an accent background
  danger: string;
  warn: Pair;
  status: Record<OrderStatus, Pair>;
}

export const lightPalette: Palette = {
  bg: "#f4f2ec",
  surface: "#fffdf9",
  text: "#17201c",
  muted: "#66706a",
  border: "#e3dfd3",
  accent: "#1d6b57",
  accentInk: "#ffffff",
  danger: "#b3261e",
  warn: { bg: "#fdf0cf", fg: "#7a4f06" },
  status: {
    PLACED: { bg: "#fdf0cf", fg: "#7a4f06" },
    APPROVED: { bg: "#dbe8fb", fg: "#1b4a94" },
    FULFILLED: { bg: "#d9f0e1", fg: "#1a6a3c" },
    REJECTED: { bg: "#fbdcd8", fg: "#9b2418" },
  },
};

export const darkPalette: Palette = {
  bg: "#0e1311",
  surface: "#161d1a",
  text: "#e8eee9",
  muted: "#93a097",
  border: "#25302a",
  accent: "#4fb99b",
  accentInk: "#052018",
  danger: "#f08c82",
  warn: { bg: "#33270c", fg: "#f1c364" },
  status: {
    PLACED: { bg: "#33270c", fg: "#f1c364" },
    APPROVED: { bg: "#14263f", fg: "#8db8f5" },
    FULFILLED: { bg: "#123123", fg: "#7fd6a1" },
    REJECTED: { bg: "#3a1c19", fg: "#f4a198" },
  },
};
