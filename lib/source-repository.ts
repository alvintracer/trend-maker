import { prisma } from "@/lib/prisma";
import { getRawDocumentCount } from "@/lib/raw-document-repository";
import { sources as sourceSeedData } from "@/lib/seed-data";

export async function ensureSeededSources() {
  for (const source of sourceSeedData) {
    await prisma.source.upsert({
      where: {
        externalId: source.id,
      },
      update: {
        name: source.name,
        url: source.url,
        kind: source.kind,
        category: source.category,
        region: source.region,
        language: source.language,
        crawlIntervalHours: source.crawlIntervalHours,
        trustScore: source.trustScore,
        status: source.status,
        notes: source.notes,
      },
      create: {
        externalId: source.id,
        name: source.name,
        url: source.url,
        kind: source.kind,
        category: source.category,
        region: source.region,
        language: source.language,
        crawlIntervalHours: source.crawlIntervalHours,
        trustScore: source.trustScore,
        status: source.status,
        notes: source.notes,
      },
    });
  }
}

export async function getSources() {
  await ensureSeededSources();

  return prisma.source.findMany({
    orderBy: [
      { trustScore: "desc" },
      { name: "asc" },
    ],
  });
}

export async function getSourceStats() {
  const [items, rawDocumentCount] = await Promise.all([getSources(), getRawDocumentCount()]);
  const activeCount = items.filter((source) => source.status === "active").length;
  const averageTrustScore =
    items.length > 0
      ? Math.round(items.reduce((total, source) => total + source.trustScore, 0) / items.length)
      : 0;

  return {
    totalCount: items.length,
    activeCount,
    averageTrustScore,
    rawDocumentCount,
  };
}
