"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { clusterSecondaryKeywords } from "@/lib/hub-service";

export async function clusterSecondaryKeywordsBulkAction(formData: FormData) {
  await assertAdminAuthenticated();
  const keywordIds = formData
    .getAll("keywordIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  await clusterSecondaryKeywords(keywordIds.length > 0 ? keywordIds : undefined);
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
