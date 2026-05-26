import { generatePrimaryKeywordsForSources } from "@/lib/keyword-service";
import { ingestSource } from "@/lib/ingestion-service";
import { prisma } from "@/lib/prisma";

async function main() {
  const targetSourceIds = ["dcinside", "fmkorea", "mlbpark", "dogdrip"];
  const resetSources = await prisma.source.findMany({
    where: {
      externalId: {
        in: targetSourceIds,
      },
    },
    select: { id: true },
  });

  for (const source of resetSources) {
    await prisma.rawDocument.deleteMany({
      where: { sourceId: source.id },
    });
  }

  const ingested = await Promise.all(
    targetSourceIds.map(async (sourceId) => {
      try {
        const result = await ingestSource(sourceId);
        return {
          ok: true,
          sourceId,
          result,
        };
      } catch (error) {
        return {
          ok: false,
          sourceId,
          error: error instanceof Error ? error.message : "Unknown ingestion error",
        };
      }
    }),
  );

  const keywordResult = await generatePrimaryKeywordsForSources(targetSourceIds);

  console.log(
    JSON.stringify(
      {
        ingested,
        keywordResult: {
          sourceCount: keywordResult.sourceCount,
          documentCount: keywordResult.documentCount,
          keywordCount: keywordResult.keywordCount,
          topKeywords: keywordResult.keywords.slice(0, 12),
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
