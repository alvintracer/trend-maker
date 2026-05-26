import { prisma } from "@/lib/prisma";
import { generateKeywordAnalysesForKeywords } from "@/lib/keyword-analysis-service";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason: "OPENAI_API_KEY is not configured",
        },
        null,
        2,
      ),
    );
    return;
  }

  const keyword = await prisma.keyword.findFirst({
    where: {
      level: "secondary",
      status: {
        in: ["tracking", "analyzed"],
      },
    },
    orderBy: [{ lastSeenAt: "desc" }],
  });

  if (!keyword) {
    throw new Error("No secondary keyword available for analysis verification");
  }

  const result = await generateKeywordAnalysesForKeywords([keyword.id]);
  const latestAnalysis = await prisma.keywordAnalysis.findFirst({
    where: {
      keywordId: keyword.id,
    },
    orderBy: {
      generatedAt: "desc",
    },
  });

  console.log(
    JSON.stringify(
      {
        keyword: {
          id: keyword.id,
          text: keyword.text,
          status: keyword.status,
        },
        generation: result,
        latestAnalysis,
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
