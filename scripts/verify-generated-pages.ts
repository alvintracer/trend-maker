import { prisma } from "@/lib/prisma";
import { generatePagesForKeywords } from "@/lib/generated-page-service";

async function main() {
  const keyword = await prisma.keyword.findFirst({
    where: {
      level: "secondary",
      status: "analyzed",
      analyses: {
        some: {},
      },
    },
    orderBy: {
      lastSeenAt: "desc",
    },
  });

  if (!keyword) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason: "No analyzed secondary keyword with analysis is available",
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await generatePagesForKeywords([keyword.id]);
  const page = await prisma.generatedPage.findUnique({
    where: {
      keywordId: keyword.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        keyword: {
          id: keyword.id,
          text: keyword.text,
        },
        generation: result,
        page,
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
