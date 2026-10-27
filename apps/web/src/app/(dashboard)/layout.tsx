import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";

// The shell (sidebar, header frame) is static. Everything that reads the session streams in
// behind a <Suspense> boundary: the user menu here, each page's data via loading.tsx.
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
      <aside className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-side px-4 py-3 text-side-ink md:sticky md:top-0 md:h-screen md:flex-col md:flex-nowrap md:items-stretch md:gap-8 md:px-4 md:py-6">
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
        <p className="mt-auto hidden px-2 text-xs text-side-muted md:block">Admin dashboard</p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-line bg-surface px-4 sm:px-8">
          <ThemeToggle />
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
