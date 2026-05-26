import type { MetadataRoute } from "next";

import { getPublishedGeneratedPages } from "@/lib/generated-page-service";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const pages = await getPublishedGeneratedPages();

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    ...pages.map((page) => ({
      url: new URL(page.canonicalPath, siteUrl).toString(),
      lastModified: page.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
