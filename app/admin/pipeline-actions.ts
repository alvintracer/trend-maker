"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { runFullPipeline } from "@/lib/full-pipeline-service";

export async function runFullPipelineAction() {
  await assertAdminAuthenticated();
  await runFullPipeline();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
