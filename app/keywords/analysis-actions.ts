"use server";

import { revalidatePath } from "next/cache";

import { generateKeywordAnalysesForKeywords } from "@/lib/keyword-analysis-service";

export async function generateKeywordAnalysisAction(formData: FormData) {
  const keywordId = Number(formData.get("keywordId"));

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await generateKeywordAnalysesForKeywords([keywordId]);
  revalidatePath("/keywords");
}

export async function generateKeywordAnalysisBulkAction(formData: FormData) {
  const keywordIds = formData
    .getAll("keywordIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (keywordIds.length === 0) {
    throw new Error("At least one keyword id is required");
  }

  await generateKeywordAnalysesForKeywords(keywordIds);
  revalidatePath("/keywords");
}
