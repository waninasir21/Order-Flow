"use server";

import { redirect } from "next/navigation";
import { BackendError, backendRequest } from "@/lib/backend";
import { LOGIN, LOGOUT, type LoginData } from "@/lib/queries";
import { writeSession } from "@/lib/session";

export interface LoginState {
  error?: string;
  phone?: string; // sent back so the phone field keeps its value after a failed attempt
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!phone || !password) return { error: "Enter your phone number and password.", phone };

  let payload: LoginData["login"];
  try {
    payload = (await backendRequest<LoginData>(LOGIN, { phone, password })).login;
  } catch (e) {
    if (e instanceof BackendError && e.kind === "graphql") {
      return {
        error: e.code === "UNAUTHENTICATED" ? "Invalid phone number or password." : e.message,
        phone,
      };
    }
    return { error: "Can't reach the server. Check that the backend is running, then try again.", phone };
  }

  // The dashboard is for admins. A rep who logs in here gets no session: we never set the
  // cookies, and we revoke the refresh token the backend just issued.
  if (payload.employee.role !== "ADMIN") {
    await backendRequest(LOGOUT, { refreshToken: payload.refreshToken }).catch(() => undefined);
    return { error: "This dashboard is for administrators. Reps use the mobile app.", phone };
  }

  await writeSession(payload.accessToken, payload.refreshToken);
  redirect("/orders"); // outside the try/catch: redirect() works by throwing
}
