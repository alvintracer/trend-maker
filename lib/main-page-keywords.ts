import { prisma } from "@/lib/prisma";

export type MainPageKeywordSnapshot = {
  text: string;
  normalizedText: string;
  count: number;
  sourceCount: number;
  sources: string[];
  sampleTitles: string[];
  lastComputedAt: Date;
};

function getMainPageKeywordDelegate() {
  const delegate = (prisma as typeof prisma & {
    mainPageKeyword?: {
      findMany: (args: {
        orderBy: Array<{
          sourceCount?: "asc" | "desc";
          count?: "asc" | "desc";
          normalizedText?: "asc" | "desc";
        }>;
        take: number;
      }) => Promise<
        Array<{
          keywordText: string;
          normalizedText: string;
          count: number;
          sourceCount: number;
          sourcesJson: string;
          sampleTitlesJson: string;
          lastComputedAt: Date;
        }>
      >;
    };
  }).mainPageKeyword;

  return delegate ?? null;
}

export async function hasMainPageKeywordTable() {
  try {
    const rows = (await prisma.$queryRaw<{ exists: string | null }[]>`
      SELECT to_regclass('trend_maker."MainPageKeyword"')::text AS exists
    `) as Array<{ exists: string | null }>;

    return Boolean(rows[0]?.exists) && getMainPageKeywordDelegate() !== null;
  } catch {
    return false;
  }
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return [];
  }

  return [];
}

export async function getMainPageKeywords(limit = 42): Promise<MainPageKeywordSnapshot[]> {
  const delegate = getMainPageKeywordDelegate();

  if (!delegate || !(await hasMainPageKeywordTable())) {
    return [];
  }

  const rows = await delegate.findMany({
    orderBy: [
      { sourceCount: "desc" },
      { count: "desc" },
      { normalizedText: "asc" },
    ],
    take: limit,
  });

  return rows.map((row) => ({
    text: row.keywordText,
    normalizedText: row.normalizedText,
    count: row.count,
    sourceCount: row.sourceCount,
    sources: parseStringArray(row.sourcesJson),
    sampleTitles: parseStringArray(row.sampleTitlesJson),
    lastComputedAt: row.lastComputedAt,
  }));
}
