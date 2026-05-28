"use server";

import { revalidatePath } from "next/cache";

import { ingestSource } from "@/lib/ingestion-service";

export async function ingestDcbestAction() {
  await ingestSource("dcinside-dcbest");
  revalidatePath("/admin");
  revalidatePath("/keywords");
}
