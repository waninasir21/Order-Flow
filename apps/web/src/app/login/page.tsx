import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-xl bg-accent font-mono text-base font-bold text-accent-ink"
          >
            OF
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">OrderFlow Admin</h1>
            <p className="text-sm text-muted">Sign in to manage orders and inventory</p>
          </div>
        </div>
        {/* The form reads ?reason=..., so it sits in a Suspense boundary. */}
        <Suspense fallback={<div className="skeleton h-72" aria-hidden />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
