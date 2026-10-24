"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const NOTICES: Record<string, string> = {
  expired: "Your session ended. Please sign in again.",
  forbidden: "That account isn't an administrator, so it can't use the dashboard.",
};

const input =
  "mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-base outline-none transition-colors focus:border-accent";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const reason = useSearchParams().get("reason");
  const notice = reason ? NOTICES[reason] : undefined;

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
      {notice && !state.error ? (
        <p role="status" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {notice}
        </p>
      ) : null}

      <div>
        <label htmlFor="phone" className="text-sm font-medium">
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="username"
          required
          defaultValue={state.phone ?? ""}
          className={input}
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-base font-semibold text-accent-ink transition-opacity disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
