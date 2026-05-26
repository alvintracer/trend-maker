"use server";

import { revalidatePath } from "next/cache";

import { clusterSecondaryKeywords } from "@/lib/hub-service";

export async function clusterSecondaryKeywordsBulkAction(formData: FormData) {
  const keywordIds = formData
    .getAll("keywordIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  await clusterSecondaryKeywords(keywordIds.length > 0 ? keywordIds : undefined);
  revalidatePath("/keywords");
}
