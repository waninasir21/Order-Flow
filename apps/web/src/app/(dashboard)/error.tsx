"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { AlertIcon } from "@/components/icons";

// In production Next hides server error messages from the browser, so this stays generic.
// The most likely cause is the backend being unreachable (stopped, or Neon waking up).
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  // reset() alone only re-renders the boundary with the SAME failed server result. To actually
  // ask the server for the page again (which also runs the proxy and its token refresh), the
  // router has to refresh too; doing both in one transition swaps the error away only once the
  // new result arrives.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-line bg-surface p-8 text-center">
      <span aria-hidden className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertIcon />
      </span>
      <h1 className="text-lg font-semibold">Couldn&apos;t load this page</h1>
      <p className="mt-2 text-sm text-muted">
        The server may be unreachable or still waking up. Your session is still active.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
      >
        Try again
      </button>
    </div>
  );
}
