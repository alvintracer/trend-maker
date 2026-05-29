import type { MetadataRoute } from "next";

import { getPublishedGeneratedPages } from "@/lib/generated-page-service";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const pages = await getPublishedGeneratedPages();
  const staticPages = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: 1,
    },
    {
      url: new URL("/privacy-policy", siteUrl).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.2,
    },
    {
      url: new URL("/terms-of-use", siteUrl).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.2,
    },
    {
      url: new URL("/donate", siteUrl).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.2,
    },
  ];

  return [
    ...staticPages,
    ...pages.map((page) => ({
      url: new URL(page.canonicalPath, siteUrl).toString(),
      lastModified: page.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
