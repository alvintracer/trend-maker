"use server";

import { revalidatePath } from "next/cache";

import {
  createManualPrimaryKeyword,
  deleteManualPrimaryKeyword,
  setKeywordPinned,
} from "@/lib/keyword-repository";

export async function updateKeywordPinnedAction(formData: FormData) {
  const keywordId = Number(formData.get("keywordId"));
  const pinned = formData.get("pinned") === "1";

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await setKeywordPinned(keywordId, pinned);
  revalidatePath("/");
  revalidatePath("/keywords");
}

export async function createManualPrimaryKeywordAction(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();

  if (!text) {
    throw new Error("Keyword text is required");
  }

  await createManualPrimaryKeyword(text);
  revalidatePath("/");
  revalidatePath("/keywords");
}

export async function deleteManualPrimaryKeywordAction(formData: FormData) {
  const keywordId = Number(formData.get("keywordId"));

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await deleteManualPrimaryKeyword(keywordId);
  revalidatePath("/");
  revalidatePath("/keywords");
}
