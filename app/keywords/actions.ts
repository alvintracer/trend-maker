"use server";

import { revalidatePath } from "next/cache";

import {
  createManualPrimaryKeywords,
  createManualPrimaryKeyword,
  deleteManualPrimaryKeyword,
  setKeywordPinned,
} from "@/lib/keyword-repository";
import { parseManualKeywordBlock } from "@/lib/manual-keyword-import";

export async function updateKeywordPinnedAction(formData: FormData) {
  const keywordId = Number(formData.get("keywordId"));
  const pinned = formData.get("pinned") === "1";

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await setKeywordPinned(keywordId, pinned);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/keywords");
}

export async function createManualPrimaryKeywordAction(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  const region = String(formData.get("region") ?? "KR").trim().toUpperCase();
  const language =
    region === "JP"
      ? "ja"
      : String(formData.get("language") ?? "ko").trim().toLowerCase() || "ko";

  if (!text) {
    throw new Error("Keyword text is required");
  }

  await createManualPrimaryKeyword({
    text,
    region,
    language,
  });
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/keywords");
}

export async function bulkImportManualPrimaryKeywordsAction(formData: FormData) {
  const block = String(formData.get("bulkText") ?? "").trim();

  if (!block) {
    throw new Error("Keyword block is required");
  }

  const entries = parseManualKeywordBlock(block);

  if (entries.length === 0) {
    throw new Error("No valid keywords found in block");
  }

  await createManualPrimaryKeywords(entries);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/keywords");
}

export async function deleteManualPrimaryKeywordAction(formData: FormData) {
  const keywordId = Number(formData.get("keywordId"));

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await deleteManualPrimaryKeyword(keywordId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/keywords");
}
