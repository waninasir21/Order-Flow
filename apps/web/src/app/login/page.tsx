import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Brand panel — full width on mobile, left half on lg ──────── */}
      <div className="relative flex shrink-0 flex-col items-center justify-center gap-6 overflow-hidden bg-side px-8 py-12 text-side-ink lg:w-[480px] lg:items-start lg:px-14 lg:py-16">
        {/* Decorative circles */}
        <span aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-white/[0.03]" />
        <span aria-hidden className="absolute -bottom-32 -left-16 size-[28rem] rounded-full bg-white/[0.03]" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-accent font-mono text-base font-bold text-accent-ink shadow-lg">
            OF
          </span>
          <span className="text-xl font-semibold tracking-tight">OrderFlow</span>
        </div>

        {/* Headline copy */}
        <div className="relative max-w-xs text-center lg:text-left">
          <h1 className="text-3xl font-semibold leading-snug tracking-tight lg:text-4xl">
            Admin dashboard
          </h1>
          <p className="mt-3 text-base leading-relaxed text-side-muted">
            Approve orders, manage inventory and monitor field sales — all in one place.
          </p>
        </div>

        {/* Feature list */}
        <ul className="relative hidden space-y-2.5 text-sm text-side-muted lg:block">
          {[
            "Real-time order approvals",
            "Live inventory management",
            "Sales analytics & trends",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Sign-in panel ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted">Enter your credentials to continue</p>
          </div>

          {/* The form reads ?reason=..., so it sits in a Suspense boundary. */}
          <Suspense fallback={<FormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-1.5">
        <div className="skeleton h-4 w-28 rounded" />
        <div className="skeleton h-11 w-full rounded-lg" />
      </div>
      <div className="space-y-1.5">
        <div className="skeleton h-4 w-20 rounded" />
        <div className="skeleton h-11 w-full rounded-lg" />
      </div>
      <div className="skeleton h-11 w-full rounded-lg" />
    </div>
  );
}
