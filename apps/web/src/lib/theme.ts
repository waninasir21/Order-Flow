"use client";

import { useSyncExternalStore } from "react";

// Theme = what the person chose: "system" (follow the OS), "light" or "dark".
// Resolved theme = what is actually shown ("light" or "dark").
// The choice lives in localStorage; the page shows it through <html data-theme="...">, which
// the CSS tokens in globals.css react to. "system" means no data-theme attribute at all.
export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "of-theme";
const THEME_EVENT = "of-theme-change";

export function readTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system"; // storage blocked (private mode): fall back to following the OS
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The choice just won't survive a reload.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function subscribe(onChange: () => void) {
  const media = darkQuery();
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

// The choice, as a hook. The server snapshot is "system", so the first render matches the
// server's HTML; the real value arrives right after hydration.
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
}

// What is on screen right now, for code that can't use CSS variables directly (charts).
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    subscribe,
    (): ResolvedTheme => {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "light" || attr === "dark") return attr;
      return darkQuery().matches ? "dark" : "light";
    },
    () => "light" as ResolvedTheme
  );
}

// Runs in <head> before the page paints, so a saved "dark" never flashes light first.
// Plain string because it executes outside React, before any bundle loads.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
