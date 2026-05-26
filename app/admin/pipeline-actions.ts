"use server";

import { revalidatePath } from "next/cache";

import { runFullPipeline } from "@/lib/full-pipeline-service";

export async function runFullPipelineAction() {
  await runFullPipeline();
  revalidatePath("/");
  revalidatePath("/keywords");
  revalidatePath("/admin");
}
