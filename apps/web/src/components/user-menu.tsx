import { logoutAction } from "@/app/(dashboard)/actions";
import { BackendError } from "@/lib/backend";
import { getAdmin } from "@/lib/dal";
import type { Me } from "@/lib/queries";

// Reads the session, so the layout renders it inside <Suspense> (see the dashboard layout).
export async function UserMenu() {
  // This component lives in the LAYOUT, and an error boundary (error.tsx) cannot catch an error
  // thrown by its own segment's layout: it would take the whole page, sidebar included, down to
  // the bare root error screen. So a backend outage degrades the menu instead of throwing; the
  // page itself reports the outage through error.tsx. Redirects (rejected session, non-admin) are
  // not BackendErrors, so they still propagate.
  let admin: Me | null = null;
  try {
    admin = await getAdmin();
  } catch (e) {
    if (!(e instanceof BackendError)) throw e;
  }

  const initials = admin
    ? admin.name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <div className="flex items-center gap-3">
      {admin ? (
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent"
          >
            {initials}
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold">{admin.name}</p>
            <p className="text-xs text-muted">Administrator</p>
          </div>
        </div>
      ) : null}
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium transition-colors hover:bg-bg"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="skeleton size-8 !rounded-full" />
      <span className="skeleton hidden h-8 w-28 sm:block" />
      <span className="skeleton h-8 w-20" />
    </div>
  );
}
