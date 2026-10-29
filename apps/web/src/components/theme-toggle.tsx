"use client";

import { applyTheme, useTheme, type Theme } from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

// One button that cycles System -> Light -> Dark. It announces the current choice and what a
// press does, because an icon alone doesn't say either.
export function ThemeToggle() {
  const theme = useTheme();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
  const Icon = theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon;

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[theme]}`}
      className="grid size-9 place-items-center rounded-lg border border-line-strong text-muted transition-colors hover:bg-bg hover:text-ink"
    >
      <Icon />
    </button>
  );
}
