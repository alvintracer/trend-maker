import { getCrawlerForSource } from "@/lib/crawler";
import { storeRawDocumentsForSource } from "@/lib/raw-document-repository";
import { prisma } from "@/lib/prisma";
import { ensureSeededSources } from "@/lib/source-repository";

export async function ingestSource(externalId: string) {
  await ensureSeededSources();

  const source = await prisma.source.findUnique({
    where: { externalId },
  });

  if (!source) {
    throw new Error(`Unknown source: ${externalId}`);
  }

  const crawler = getCrawlerForSource(externalId);

  if (!crawler) {
    throw new Error(`No crawler registered for source: ${externalId}`);
  }

  try {
    const crawlResult = await crawler.fetchDocuments(source.url);
    const result = await storeRawDocumentsForSource(source.id, crawlResult.documents);

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCrawledAt: new Date(),
        lastCrawlStatus: "success",
        lastCrawlMethod: crawlResult.method,
        lastCrawlDetail: crawlResult.detail ?? null,
      },
    });

    return {
      source: {
        id: source.id,
        externalId: source.externalId,
        name: source.name,
        url: source.url,
      },
      fetchedCount: crawlResult.documents.length,
      storedCount: result.storedCount,
      method: crawlResult.method,
      detail: crawlResult.detail,
    };
  } catch (error) {
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCrawlStatus: "error",
        lastCrawlMethod: null,
        lastCrawlDetail: error instanceof Error ? error.message.slice(0, 500) : "Unknown ingestion error",
      },
    });

    throw error;
  }
}
