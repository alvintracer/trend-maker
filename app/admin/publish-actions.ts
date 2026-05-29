"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { setPublishMinRepresentativeOpportunity } from "@/lib/publish-settings";

export async function updatePublishThresholdAction(formData: FormData) {
  await assertAdminAuthenticated();

  const rawValue = Number(formData.get("minRepresentativeOpportunity"));

  if (!Number.isFinite(rawValue) || rawValue < 0) {
    throw new Error("Invalid publish opportunity threshold");
  }

  await setPublishMinRepresentativeOpportunity(rawValue);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
