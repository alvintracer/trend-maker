import { prisma } from "@/lib/prisma";
import { generateSecondaryKeywordsForPrimaryKeywords } from "@/lib/secondary-keyword-service";

async function main() {
  const primaryKeyword = await prisma.keyword.findFirst({
    where: {
      level: "primary",
      status: "tracking",
    },
    orderBy: [
      { pinnedAt: "desc" },
      { lastSeenAt: "desc" },
    ],
  });

  if (!primaryKeyword) {
    throw new Error("No primary keyword available for secondary verification");
  }

  const result = await generateSecondaryKeywordsForPrimaryKeywords([primaryKeyword.id], 10, {
    providerMode: "trends",
  });
  const secondaryKeywords = await prisma.keywordSuggestResult.findMany({
    where: {
      parentKeywordId: primaryKeyword.id,
    },
    include: {
      suggestedKeyword: true,
    },
    orderBy: {
      rank: "asc",
    },
    take: 10,
  });

  console.log(
    JSON.stringify(
      {
        primaryKeyword: {
          id: primaryKeyword.id,
          text: primaryKeyword.text,
          normalizedText: primaryKeyword.normalizedText,
        },
        generation: result,
        secondaryKeywords: secondaryKeywords.map((item) => ({
          rank: item.rank,
          provider: item.provider,
          query: item.query,
          text: item.suggestedKeyword.text,
          normalizedText: item.suggestedKeyword.normalizedText,
        })),
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
