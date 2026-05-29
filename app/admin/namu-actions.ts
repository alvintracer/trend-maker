"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import {
  NAMU_AV_ACTIVE_INITIALS,
  type SupportedInitial,
  syncAllNamuAvActorInitialPages,
  syncNamuAvActorInitialPage,
} from "@/lib/namu-av-actors";

export async function syncNamuInitialPageAction(
  _prevState: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await assertAdminAuthenticated();
  const initial = String(formData.get("initial") ?? "").trim() as SupportedInitial;

  if (!NAMU_AV_ACTIVE_INITIALS.includes(initial)) {
    return { ok: false, error: "잘못된 초성입니다." };
  }

  try {
    await syncNamuAvActorInitialPage(initial);
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/keywords");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "동기화 중 오류가 발생했습니다.",
    };
  }
}

export async function syncAllNamuInitialPagesAction(
  _prevState: { ok: boolean; error?: string } | null,
): Promise<{ ok: boolean; error?: string }> {
  await assertAdminAuthenticated();

  try {
    await syncAllNamuAvActorInitialPages();
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/keywords");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "전체 동기화 중 오류가 발생했습니다.",
    };
  }
}
