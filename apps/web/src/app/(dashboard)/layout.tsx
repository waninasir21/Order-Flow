import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";

// Shell layout:
//   mobile  → full-width content + fixed bottom tab bar (no sidebar)
//   md+     → 232 px sidebar on the left + content on the right (sticky sidebar)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      {/* First stop for keyboard users: jump past the sidebar to the page. */}
      <a
        href="#main"
        className="sr-only rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden bg-side text-side-ink md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-8 md:px-4 md:py-6">
        <div className="flex items-center gap-2.5 px-2">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-lg bg-accent font-mono text-sm font-bold text-accent-ink"
          >
            OF
          </span>
          <span className="text-base font-semibold tracking-tight">OrderFlow</span>
        </div>
        <SidebarNav />
        <p className="mt-auto px-2 text-xs text-side-muted">Admin dashboard</p>
      </aside>

      {/* ── Main content column ─────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col pb-16 md:pb-0">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6 md:justify-end">
          {/* Brand mark visible only on mobile (sidebar is hidden) */}
          <div className="flex items-center gap-2 md:hidden">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-md bg-accent font-mono text-xs font-bold text-accent-ink"
            >
              OF
            </span>
            <span className="text-sm font-semibold tracking-tight">OrderFlow</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────────────── */}
      <nav
        aria-label="Main"
        className="safe-bottom fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-side md:hidden"
      >
        <SidebarNav mobile />
      </nav>
    </div>
  );
}
