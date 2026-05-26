"use server";

import { revalidatePath } from "next/cache";

import {
  publishGeneratedPage,
  publishHub,
  unpublishGeneratedPage,
  unpublishHub,
} from "@/lib/publish-service";

export async function publishHubAction(formData: FormData) {
  const hubId = Number(formData.get("hubId"));

  if (!Number.isFinite(hubId) || hubId <= 0) {
    throw new Error("Invalid hub id");
  }

  await publishHub(hubId);
  revalidatePath("/keywords");
}

export async function unpublishHubAction(formData: FormData) {
  const hubId = Number(formData.get("hubId"));

  if (!Number.isFinite(hubId) || hubId <= 0) {
    throw new Error("Invalid hub id");
  }

  await unpublishHub(hubId);
  revalidatePath("/keywords");
}

export async function publishGeneratedPageAction(formData: FormData) {
  const pageId = Number(formData.get("pageId"));

  if (!Number.isFinite(pageId) || pageId <= 0) {
    throw new Error("Invalid page id");
  }

  await publishGeneratedPage(pageId);
  revalidatePath("/keywords");
}

export async function unpublishGeneratedPageAction(formData: FormData) {
  const pageId = Number(formData.get("pageId"));

  if (!Number.isFinite(pageId) || pageId <= 0) {
    throw new Error("Invalid page id");
  }

  await unpublishGeneratedPage(pageId);
  revalidatePath("/keywords");
}
