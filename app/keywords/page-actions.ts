"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { generatePagesForKeywords } from "@/lib/generated-page-service";

export async function generateKeywordPageAction(formData: FormData) {
  await assertAdminAuthenticated();
  const keywordId = Number(formData.get("keywordId"));

  if (!Number.isFinite(keywordId) || keywordId <= 0) {
    throw new Error("Invalid keyword id");
  }

  await generatePagesForKeywords([keywordId]);
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}

export async function generateKeywordPageBulkAction(formData: FormData) {
  await assertAdminAuthenticated();
  const keywordIds = formData
    .getAll("keywordIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (keywordIds.length === 0) {
    throw new Error("At least one keyword id is required");
  }

  await generatePagesForKeywords(keywordIds);
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
