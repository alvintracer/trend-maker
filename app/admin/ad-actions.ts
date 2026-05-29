"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { setAdSlotEnabled } from "@/lib/ad-settings";
import type { AdSlotKey } from "@/lib/adsterra";
import { setTrafficRedirectSettings } from "@/lib/traffic-redirect-settings";

export async function updateAdSlotEnabledAction(formData: FormData) {
  await assertAdminAuthenticated();
  const slotKey = String(formData.get("slotKey") ?? "") as AdSlotKey;
  const enabled = formData.get("enabled") === "1";

  await setAdSlotEnabled(slotKey, enabled);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}

export async function updateTrafficRedirectSettingsAction(formData: FormData) {
  await assertAdminAuthenticated();

  await setTrafficRedirectSettings({
    enabled: formData.get("enabled") === "1",
    smartlinkUrl: "",
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/keywords");
}
