"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import {
  createManualSecondaryKeywords,
  createManualPrimaryKeywords,
  createManualPrimaryKeyword,
  deleteManualPrimaryKeyword,
  setKeywordPinned,
} from "@/lib/keyword-repository";
import { parseManualKeywordBlock } from "@/lib/manual-keyword-import";

export async function updateKeywordPinnedAction(formData: FormData) {
  await assertAdminAuthenticated();
  const keywordId = Number(formData.get("keywordId"));
  const pinned = formData.get("pinned") === "1";

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await setKeywordPinned(keywordId, pinned);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}

export async function createManualPrimaryKeywordAction(formData: FormData) {
  await assertAdminAuthenticated();
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
  revalidatePath("/admin/keywords");
}

export async function bulkImportManualPrimaryKeywordsAction(formData: FormData) {
  await assertAdminAuthenticated();
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
  revalidatePath("/admin/keywords");
}

export async function deleteManualPrimaryKeywordAction(formData: FormData) {
  await assertAdminAuthenticated();
  const keywordId = Number(formData.get("keywordId"));

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await deleteManualPrimaryKeyword(keywordId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}

export async function bulkImportManualSecondaryKeywordsAction(formData: FormData) {
  await assertAdminAuthenticated();
  const block = String(formData.get("bulkText") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const region = String(formData.get("region") ?? "KR").trim().toUpperCase();
  const language =
    region === "JP"
      ? "ja"
      : String(formData.get("language") ?? "ko").trim().toLowerCase() || "ko";
  const rawParentKeywordId = String(formData.get("parentKeywordId") ?? "").trim();
  const parentKeywordId =
    rawParentKeywordId.length > 0 && Number.isFinite(Number(rawParentKeywordId))
      ? Number(rawParentKeywordId)
      : null;

  if (block.length === 0) {
    throw new Error("Secondary keyword block is required");
  }

  await createManualSecondaryKeywords(
    block.map((text) => ({
      text,
      region,
      language,
      parentKeywordId,
    })),
  );
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
