"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Keeps a server-rendered page fresh without the browser ever holding the access token: every
// `intervalMs` (and the moment the tab becomes visible again) it asks Next to re-render the
// page's server components, which re-run their backend queries with the httpOnly cookie.
// Client state (filters, an open stock editor, the optimistic layer) survives a refresh.
// A hidden tab does nothing, so a forgotten dashboard tab doesn't poll the backend all night.
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
