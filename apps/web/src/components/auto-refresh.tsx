"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Keeps a server-rendered page fresh without the browser ever holding the access token: every
// `intervalMs` (and the moment the tab becomes visible again) it asks Next to re-render the
// page's server components, which re-run their backend queries with the httpOnly cookie.
// Client state (filters, an open stock editor, the optimistic layer) survives a refresh.
// A hidden tab does nothing, so a forgotten dashboard tab doesn't poll the backend all night.
// `enabled` lets callers pause polling (e.g. when there is nothing to refresh yet).
export function AutoRefresh({ intervalMs = 10_000, enabled = true }: { intervalMs?: number; enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs, enabled]);

  return null;
}
