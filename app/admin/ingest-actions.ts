"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { ingestSource } from "@/lib/ingestion-service";

export async function ingestDcbestAction() {
  await assertAdminAuthenticated();
  await ingestSource("dcinside-dcbest");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
