"use server";

import { revalidatePath } from "next/cache";

import { generatePagesForKeywords } from "@/lib/generated-page-service";

export async function generateKeywordPageAction(formData: FormData) {
  const keywordId = Number(formData.get("keywordId"));

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await generatePagesForKeywords([keywordId]);
  revalidatePath("/keywords");
}

export async function generateKeywordPageBulkAction(formData: FormData) {
  const keywordIds = formData
    .getAll("keywordIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (keywordIds.length === 0) {
    throw new Error("At least one keyword id is required");
  }

  await generatePagesForKeywords(keywordIds);
  revalidatePath("/keywords");
}
