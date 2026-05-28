"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { setAdSlotEnabled } from "@/lib/ad-settings";
import type { AdSlotKey } from "@/lib/adsterra";

export async function updateAdSlotEnabledAction(formData: FormData) {
  await assertAdminAuthenticated();
  const slotKey = String(formData.get("slotKey") ?? "") as AdSlotKey;
  const enabled = formData.get("enabled") === "1";

  await setAdSlotEnabled(slotKey, enabled);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
