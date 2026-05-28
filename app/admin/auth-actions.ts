"use server";

import { redirect } from "next/navigation";

import {
  clearAdminSession,
  createAdminSession,
  validateAdminPassword,
} from "@/lib/admin-auth";

export async function loginAdminAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/admin").trim() || "/admin";

  if (!validateAdminPassword(password)) {
    redirect(`/admin/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  await createAdminSession();
  redirect(nextPath.startsWith("/") ? nextPath : "/admin");
}

export async function logoutAdminAction() {
  await clearAdminSession();
  redirect("/admin/login");
}
