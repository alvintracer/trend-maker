import type { MetadataRoute } from "next";

import { getPublishedGeneratedPages } from "@/lib/generated-page-service";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const pages = await getPublishedGeneratedPages();

  return pages.map((page) => ({
    url: new URL(page.canonicalPath, siteUrl).toString(),
    lastModified: page.updatedAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));
}
