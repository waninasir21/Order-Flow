import { BackendError } from "./backend";

// What a server action returns to the browser. Plain data only: an Error object can't cross
// the server/client boundary, and production Next hides thrown messages anyway.
export type ActionResult = { ok: true } | { ok: false; message: string };

// Turns a failed backend call into a message for the person clicking. Anything that is not a
// BackendError (including the redirect Next throws when the session is over) is rethrown.
export function toFailure(e: unknown): { ok: false; message: string; stale: boolean } {
  if (!(e instanceof BackendError)) throw e;
  if (e.kind === "network") {
    return {
      ok: false,
      stale: false,
      message: "Couldn't reach the server, so the change may not have been saved. Check, then try again.",
    };
  }
  switch (e.code) {
    case "FORBIDDEN":
      return { ok: false, stale: false, message: "Your account isn't allowed to do that." };
    case "NOT_FOUND":
      return { ok: false, stale: true, message: "That item no longer exists." };
    case "CONFLICT":
    case "BAD_USER_INPUT":
      // e.g. another admin already approved the order. The backend's message says what happened.
      return { ok: false, stale: true, message: e.message };
    default:
      return { ok: false, stale: false, message: "Something went wrong. Please try again." };
  }
}
