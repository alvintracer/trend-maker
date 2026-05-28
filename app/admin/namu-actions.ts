"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { syncNamuAvActorInitialPage } from "@/lib/namu-av-actors";

export async function syncNamuInitialPageAction(formData: FormData) {
  await assertAdminAuthenticated();
  const initial = String(formData.get("initial") ?? "").trim() as "ㄱ" | "ㄴ" | "ㄷ" | "ㄹ" | "ㅁ";

  if (!["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"].includes(initial)) {
    throw new Error("Invalid initial");
  }

  await syncNamuAvActorInitialPage(initial);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
