"use server";

import { revalidatePath } from "next/cache";

import { assertAdminAuthenticated } from "@/lib/admin-auth";
import {
  publishGeneratedPage,
  publishHub,
  unpublishGeneratedPage,
  unpublishHub,
} from "@/lib/publish-service";

export async function publishHubAction(formData: FormData) {
  await assertAdminAuthenticated();
  const hubId = Number(formData.get("hubId"));

  if (!Number.isFinite(hubId) || hubId <= 0) {
    throw new Error("Invalid hub id");
  }

  await publishHub(hubId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}

export async function unpublishHubAction(formData: FormData) {
  await assertAdminAuthenticated();
  const hubId = Number(formData.get("hubId"));

  if (!Number.isFinite(hubId) || hubId <= 0) {
    throw new Error("Invalid hub id");
  }

  await unpublishHub(hubId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}

export async function publishGeneratedPageAction(formData: FormData) {
  await assertAdminAuthenticated();
  const pageId = Number(formData.get("pageId"));

  if (!Number.isFinite(pageId) || pageId <= 0) {
    throw new Error("Invalid page id");
  }

  await publishGeneratedPage(pageId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}

export async function unpublishGeneratedPageAction(formData: FormData) {
  await assertAdminAuthenticated();
  const pageId = Number(formData.get("pageId"));

  if (!Number.isFinite(pageId) || pageId <= 0) {
    throw new Error("Invalid page id");
  }

  await unpublishGeneratedPage(pageId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/keywords");
}
