import { KeywordLevel, KeywordStatus, Prisma } from "@prisma/client";

import { parseKeywordSourceIds } from "@/lib/keyword-repository";
import { fetchGoogleSuggestCandidates } from "@/lib/keyword-suggest";
import { prisma } from "@/lib/prisma";
import type { SecondaryKeywordCandidate } from "@/lib/types";

const SECONDARY_KEYWORD_RULES = {
  minFrequencyScore: 1,
  minSourceCount: 1,
  minSuggestScore: 2.5,
  minOpportunityScore: 8,
  analyzedOpportunityScore: 14,
} as const;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function mergeSourceIdsRaw(values: Array<string | null | undefined>) {
  return [...new Set(values.flatMap((value) => parseKeywordSourceIds(value)))].sort().join(",");
}

function getCommercialIntentScore(text: string) {
  const lower = text.toLowerCase();
  const modifiers = [
    "가격",
    "후기",
    "리뷰",
    "추천",
    "예약",
    "위치",
    "비용",
    "할인",
    "구매",
    "사전예약",
    "일정",
    "사용법",
  ];

  return modifiers.reduce((score, modifier) => score + (lower.includes(modifier) ? 1 : 0), 0);
}

export async function generateSecondaryKeywordsForPrimaryKeywords(
  parentKeywordIds: number[],
  limitPerKeyword = 10,
) {
  const parentKeywords = await prisma.keyword.findMany({
    where: {
      id: {
        in: parentKeywordIds,
      },
      level: KeywordLevel.primary,
    },
    include: {
      metrics: {
        orderBy: {
          metricDate: "desc",
        },
        take: 1,
      },
    },
  });

  if (parentKeywords.length === 0) {
    throw new Error("No matching primary keywords found for secondary generation");
  }

  const allCandidates: SecondaryKeywordCandidate[] = [];
  const parentKeywordsById = new Map(parentKeywords.map((keyword) => [keyword.id, keyword]));

  for (const parentKeyword of parentKeywords) {
    const candidates = await fetchGoogleSuggestCandidates(parentKeyword.id, parentKeyword.text);
    allCandidates.push(...candidates.slice(0, limitPerKeyword));
  }

  const touchedSecondaryKeywordIds = new Set<number>();

  for (const candidate of allCandidates) {
    const parentKeyword = parentKeywordsById.get(candidate.parentKeywordId);

    if (!parentKeyword) {
      continue;
    }

    const existingKeyword = await prisma.keyword.findUnique({
      where: {
        normalizedText: candidate.normalizedText,
      },
      select: {
        id: true,
        sourceIdsRaw: true,
        parentKeywordId: true,
      },
    });

    const mergedSourceIdsRaw = mergeSourceIdsRaw([
      existingKeyword?.sourceIdsRaw,
      parentKeyword.sourceIdsRaw,
    ]);

    const secondaryKeyword = await prisma.keyword.upsert({
      where: {
        normalizedText: candidate.normalizedText,
      },
      update: {
        text: candidate.text,
        level: KeywordLevel.secondary,
        sourceLabel: candidate.provider,
        sourceIdsRaw: mergedSourceIdsRaw,
        lastSeenAt: new Date(),
        status: KeywordStatus.tracking,
      },
      create: {
        text: candidate.text,
        normalizedText: candidate.normalizedText,
        level: KeywordLevel.secondary,
        parentKeywordId: parentKeyword.id,
        region: "KR",
        language: "ko",
        sourceLabel: candidate.provider,
        sourceIdsRaw: mergedSourceIdsRaw,
        status: KeywordStatus.tracking,
      },
    });

    touchedSecondaryKeywordIds.add(secondaryKeyword.id);

    await prisma.keywordSuggestResult.upsert({
      where: {
        parentKeywordId_suggestedKeywordId_provider: {
          parentKeywordId: candidate.parentKeywordId,
          suggestedKeywordId: secondaryKeyword.id,
          provider: candidate.provider,
        },
      },
      update: {
        rank: candidate.rank,
        query: candidate.query,
        fetchedAt: new Date(),
      },
      create: {
        parentKeywordId: candidate.parentKeywordId,
        suggestedKeywordId: secondaryKeyword.id,
        provider: candidate.provider,
        rank: candidate.rank,
        query: candidate.query,
      },
    });
  }

  await recomputeSecondaryKeywordMetrics([...touchedSecondaryKeywordIds]);

  const evaluation = await summarizeSecondaryKeywordStatuses([...touchedSecondaryKeywordIds]);

  return {
    parentKeywordCount: parentKeywords.length,
    secondaryKeywordCount: allCandidates.length,
    acceptedSecondaryKeywordCount: evaluation.acceptedCount,
    blockedSecondaryKeywordCount: evaluation.blockedCount,
  };
}

export async function recomputeSecondaryKeywordMetrics(keywordIds?: number[]) {
  const metricDate = startOfToday();
  const secondaryKeywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.secondary,
      ...(keywordIds && keywordIds.length > 0
        ? {
            id: {
              in: keywordIds,
            },
          }
        : {}),
    },
    include: {
      suggestedBy: {
        include: {
          parentKeyword: {
            include: {
              metrics: {
                orderBy: {
                  metricDate: "desc",
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  for (const keyword of secondaryKeywords) {
    const parentCount = new Set(keyword.suggestedBy.map((entry) => entry.parentKeywordId)).size;
    const sourceIds = new Set(
      keyword.suggestedBy.flatMap((entry) => parseKeywordSourceIds(entry.parentKeyword.sourceIdsRaw)),
    );
    const averageRank =
      keyword.suggestedBy.length > 0
        ? keyword.suggestedBy.reduce((sum, entry) => sum + entry.rank, 0) /
          keyword.suggestedBy.length
        : 10;
    const rankScore = Math.max(0, 11 - averageRank);
    const parentOpportunityAverage =
      keyword.suggestedBy.length > 0
        ? keyword.suggestedBy.reduce(
            (sum, entry) => sum + (entry.parentKeyword.metrics[0]?.opportunityScore ?? 0),
            0,
          ) / keyword.suggestedBy.length
        : 0;
    const commercialScore = getCommercialIntentScore(keyword.text);
    const frequencyScore = keyword.suggestedBy.length;
    const sourceCount = sourceIds.size;
    const trendScore = Number((parentCount * 1.5 + parentOpportunityAverage * 0.15).toFixed(2));
    const suggestScore = Number(rankScore.toFixed(2));
    const opportunityScore = Number(
      (
        parentCount * 1.8 +
        sourceCount * 1.6 +
        suggestScore * 0.7 +
        parentOpportunityAverage * 0.22 +
        commercialScore * 0.9
      ).toFixed(2),
    );
    const nextStatus = classifySecondaryKeywordStatus({
      frequencyScore,
      sourceCount,
      suggestScore,
      opportunityScore,
    });

    await prisma.keyword.update({
      where: {
        id: keyword.id,
      },
      data: {
        sourceIdsRaw: [...sourceIds].sort().join(","),
        status: nextStatus,
      },
    });

    await prisma.keywordMetric.upsert({
      where: {
        keywordId_metricDate: {
          keywordId: keyword.id,
          metricDate,
        },
      },
      update: {
        frequencyScore,
        trendScore,
        sourceCount,
        suggestScore,
        commercialScore,
        opportunityScore,
      },
      create: {
        keywordId: keyword.id,
        metricDate,
        frequencyScore,
        trendScore,
        sourceCount,
        suggestScore,
        commercialScore,
        opportunityScore,
      },
    });
  }
}

function classifySecondaryKeywordStatus({
  frequencyScore,
  sourceCount,
  suggestScore,
  opportunityScore,
}: {
  frequencyScore: number;
  sourceCount: number;
  suggestScore: number;
  opportunityScore: number;
}) {
  if (
    frequencyScore < SECONDARY_KEYWORD_RULES.minFrequencyScore ||
    sourceCount < SECONDARY_KEYWORD_RULES.minSourceCount ||
    suggestScore < SECONDARY_KEYWORD_RULES.minSuggestScore ||
    opportunityScore < SECONDARY_KEYWORD_RULES.minOpportunityScore
  ) {
    return KeywordStatus.blocked;
  }

  if (opportunityScore >= SECONDARY_KEYWORD_RULES.analyzedOpportunityScore) {
    return KeywordStatus.analyzed;
  }

  return KeywordStatus.tracking;
}

async function summarizeSecondaryKeywordStatuses(keywordIds: number[]) {
  if (keywordIds.length === 0) {
    return {
      acceptedCount: 0,
      blockedCount: 0,
    };
  }

  const keywords = await prisma.keyword.findMany({
    where: {
      id: {
        in: keywordIds,
      },
      level: KeywordLevel.secondary,
    },
    select: {
      status: true,
    },
  });

  const blockedCount = keywords.filter((keyword) => keyword.status === KeywordStatus.blocked).length;

  return {
    acceptedCount: keywords.length - blockedCount,
    blockedCount,
  };
}

export async function getSecondaryKeywordsForPrimaryKeyword(parentKeywordId: number) {
  return prisma.keywordSuggestResult.findMany({
    where: {
      parentKeywordId,
    },
    include: {
      suggestedKeyword: {
        include: {
          metrics: {
            orderBy: {
              metricDate: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ rank: "asc" }, { fetchedAt: "desc" }],
    take: 20,
  });
}

export async function getSecondaryKeywordsForPrimaryKeywords(parentKeywordIds: number[]) {
  if (parentKeywordIds.length === 0) {
    return new Map<number, Awaited<ReturnType<typeof getSecondaryKeywordsForPrimaryKeyword>>>();
  }

  const rows = await prisma.keywordSuggestResult.findMany({
    where: {
      parentKeywordId: {
        in: parentKeywordIds,
      },
    },
    include: {
      suggestedKeyword: {
        include: {
          metrics: {
            orderBy: {
              metricDate: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ parentKeywordId: "asc" }, { rank: "asc" }, { fetchedAt: "desc" }],
    take: Math.max(parentKeywordIds.length * 20, 20),
  });

  const grouped = new Map<
    number,
    Awaited<ReturnType<typeof getSecondaryKeywordsForPrimaryKeyword>>
  >();

  for (const row of rows) {
    const current = grouped.get(row.parentKeywordId) ?? [];

    if (current.length < 20) {
      current.push(row);
      grouped.set(row.parentKeywordId, current);
    }
  }

  return grouped;
}

export type SecondaryKeywordInventoryQuery = {
  parentKeywordIds?: number[];
  limit?: number;
  sort?: "rank" | "newest" | "alpha" | "opportunity";
  statuses?: KeywordStatus[];
};

type SecondaryKeywordInventoryRecord = Prisma.KeywordGetPayload<{
  include: {
    analyses: {
      orderBy: {
        generatedAt: "desc";
      };
      take: 1;
    };
    generatedPages: {
      orderBy: {
        lastGeneratedAt: "desc";
      };
      take: 1;
    };
    metrics: {
      orderBy: {
        metricDate: "desc";
      };
      take: 1;
    };
    suggestedBy: {
      include: {
        parentKeyword: true;
      };
    };
  };
}>;

export async function getSecondaryKeywordInventory(
  query: SecondaryKeywordInventoryQuery = {},
) {
  const {
    parentKeywordIds = [],
    limit = 200,
    sort = "opportunity",
    statuses = [KeywordStatus.tracking, KeywordStatus.analyzed],
  } = query;

  const keywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.secondary,
      status: {
        in: statuses,
      },
      ...(parentKeywordIds.length > 0
        ? {
            suggestedBy: {
              some: {
                parentKeywordId: {
                  in: parentKeywordIds,
                },
              },
            },
          }
        : {}),
    },
    include: {
      analyses: {
        orderBy: {
          generatedAt: "desc",
        },
        take: 1,
      },
      generatedPages: {
        orderBy: {
          lastGeneratedAt: "desc",
        },
        take: 1,
      },
      metrics: {
        orderBy: {
          metricDate: "desc",
        },
        take: 1,
      },
      suggestedBy: {
        include: {
          parentKeyword: true,
        },
      },
    },
    take: Math.max(limit, 20),
  });

  return keywords
    .sort((left, right) => compareSecondaryKeywords(left, right, sort))
    .slice(0, limit);
}

export function getSecondaryKeywordRules() {
  return SECONDARY_KEYWORD_RULES;
}

export function parseSecondaryStatuses(value?: string) {
  if (!value || value === "active") {
    return [KeywordStatus.tracking, KeywordStatus.analyzed];
  }

  if (value === "tracking") {
    return [KeywordStatus.tracking];
  }

  if (value === "analyzed") {
    return [KeywordStatus.analyzed];
  }

  if (value === "blocked") {
    return [KeywordStatus.blocked];
  }

  if (value === "all") {
    return [KeywordStatus.tracking, KeywordStatus.analyzed, KeywordStatus.blocked];
  }

  return [KeywordStatus.tracking, KeywordStatus.analyzed];
}

function compareSecondaryKeywords(
  left: SecondaryKeywordInventoryRecord,
  right: SecondaryKeywordInventoryRecord,
  sort: NonNullable<SecondaryKeywordInventoryQuery["sort"]>,
) {
  const leftMetric = left.metrics[0];
  const rightMetric = right.metrics[0];
  const leftOpportunity = leftMetric?.opportunityScore ?? 0;
  const rightOpportunity = rightMetric?.opportunityScore ?? 0;
  const leftSuggestScore = leftMetric?.suggestScore ?? 0;
  const rightSuggestScore = rightMetric?.suggestScore ?? 0;

  if (sort === "alpha") {
    return left.text.localeCompare(right.text, "ko");
  }

  if (sort === "newest") {
    return right.lastSeenAt.getTime() - left.lastSeenAt.getTime();
  }

  if (sort === "rank") {
    if (rightSuggestScore !== leftSuggestScore) {
      return rightSuggestScore - leftSuggestScore;
    }
  }

  if (rightOpportunity !== leftOpportunity) {
    return rightOpportunity - leftOpportunity;
  }

  return right.suggestedBy.length - left.suggestedBy.length;
}
