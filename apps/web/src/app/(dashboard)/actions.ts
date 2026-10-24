"use server";

import { redirect } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import { LOGOUT } from "@/lib/queries";
import { clearSession, readSession } from "@/lib/session";

export async function logoutAction() {
  const { refreshToken } = await readSession();
  if (refreshToken) {
    // Best effort: revoke it on the server so a copied token is useless. Even if the backend
    // is down, the cookies are still cleared below.
    await backendRequest(LOGOUT, { refreshToken }).catch(() => undefined);
  }
  await clearSession();
  redirect("/login");
}
