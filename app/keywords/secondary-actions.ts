"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { generateSecondaryKeywordsForPrimaryKeywords } from "@/lib/secondary-keyword-service";

export async function generateSecondaryKeywordsAction(formData: FormData) {
  await assertAdminAuthenticated();
  const keywordId = Number(formData.get("keywordId"));

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await generateSecondaryKeywordsForPrimaryKeywords([keywordId]);
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}

export async function generateSecondaryKeywordsBulkAction(formData: FormData) {
  await assertAdminAuthenticated();
  const keywordIds = formData
    .getAll("keywordIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (keywordIds.length === 0) {
    throw new Error("At least one keyword id is required");
  }

  await generateSecondaryKeywordsForPrimaryKeywords(keywordIds);
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
