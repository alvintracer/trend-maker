import { prisma } from "@/lib/prisma";
import { extractPrimaryKeywordCandidates } from "@/lib/keyword-extractor";
import { upsertPrimaryKeywords } from "@/lib/keyword-repository";
import { ensureSeededSources } from "@/lib/source-repository";

export async function generatePrimaryKeywordsForSources(externalIds: string[]) {
  await ensureSeededSources();

  const sources = await prisma.source.findMany({
    where: {
      externalId: {
        in: externalIds,
      },
    },
    select: {
      id: true,
      externalId: true,
      name: true,
    },
  });

  if (sources.length === 0) {
    throw new Error("No matching sources found for keyword extraction");
  }

  const sourceIds = sources.map((source) => source.id);
  const sourceExternalIdById = new Map(sources.map((source) => [source.id, source.externalId]));
  const rawDocuments = await prisma.rawDocument.findMany({
    where: {
      sourceId: {
        in: sourceIds,
      },
    },
    orderBy: {
      crawledAt: "desc",
    },
    take: 150,
    select: {
      sourceId: true,
      title: true,
      content: true,
    },
  });

  if (rawDocuments.length === 0) {
    throw new Error("No raw documents available. Run ingestion first.");
  }

  const candidates = extractPrimaryKeywordCandidates(
    rawDocuments.map((document) => ({
      sourceId: sourceExternalIdById.get(document.sourceId) ?? String(document.sourceId),
      text: document.title || document.content,
    })),
  );

  await upsertPrimaryKeywords(candidates);

  return {
    sourceIds: externalIds,
    sourceCount: sources.length,
    documentCount: rawDocuments.length,
    keywordCount: candidates.length,
    keywords: candidates,
  };
}
