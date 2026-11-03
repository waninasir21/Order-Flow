"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { loginAction, type LoginState } from "./actions";

const NOTICES: Record<string, { message: string; tone: "warn" | "danger" }> = {
  expired: {
    message: "Your session has ended. Please sign in again.",
    tone: "warn",
  },
  forbidden: {
    message: "That account isn't an administrator. Reps use the mobile app.",
    tone: "danger",
  },
};

export function LoginForm() {
  const phoneId = useId();
  const passwordId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const reason = useSearchParams().get("reason");
  const notice = reason ? NOTICES[reason] : undefined;

  return (
    <form action={action} noValidate className="space-y-5">
      {/* Session-expired / forbidden notice */}
      {notice && !state.error ? (
        <Notice tone={notice.tone}>{notice.message}</Notice>
      ) : null}

      {/* Phone */}
      <div className="space-y-1.5">
        <label htmlFor={phoneId} className="block text-sm font-medium">
          Phone number
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            <PhoneIcon />
          </span>
          <input
            id={phoneId}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            required
            defaultValue={state.phone ?? ""}
            aria-invalid={!!state.error}
            aria-describedby={state.error ? "form-error" : undefined}
            className="w-full rounded-lg border border-line-strong bg-surface py-2.5 pl-10 pr-3 text-base outline-none transition-colors placeholder:text-muted/60 focus:border-accent disabled:opacity-50"
            placeholder="10 digit phone number"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor={passwordId} className="block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            <LockIcon />
          </span>
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={!!state.error}
            className="w-full rounded-lg border border-line-strong bg-surface py-2.5 pl-10 pr-10 text-base outline-none transition-colors focus:border-accent disabled:opacity-50"
            placeholder="password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-ink"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {state.error ? (
        <Notice tone="danger" id="form-error">{state.error}</Notice>
      ) : null}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="relative flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-base font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Spinner />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>

      <p className="text-center text-xs text-muted">
        Administrators only. Sales reps use the&nbsp;mobile&nbsp;app.
      </p>
    </form>
  );
}

/* ── Small primitives ───────────────────────────────────────────── */

function Notice({
  tone,
  id,
  children,
}: {
  tone: "warn" | "danger";
  id?: string;
  children: React.ReactNode;
}) {
  const colors =
    tone === "danger"
      ? "bg-danger-soft text-danger"
      : "bg-warn-soft text-warn";
  return (
    <div
      id={id}
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm leading-snug ${colors}`}
    >
      {tone === "danger" ? <AlertCircleIcon className="mt-px shrink-0" /> : <InfoIcon className="mt-px shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Icons (inline SVG keeps bundle small) ──────────────────────── */
const iconBase = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function PhoneIcon() {
  return (
    <svg {...iconBase}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" strokeWidth={2.5} />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...iconBase}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg {...iconBase} width={18} height={18}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconBase} width={18} height={18}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg {...iconBase} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" strokeWidth={2} />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg {...iconBase} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" strokeWidth={2} />
    </svg>
  );
}
