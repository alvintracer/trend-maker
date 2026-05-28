import { KeywordLevel, KeywordStatus, Prisma } from "@prisma/client";

import { fetchGoogleTrendsRelatedQueryCandidates } from "@/lib/google-trends";
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

const SUGGEST_CACHE_TTL_HOURS = 12;
const SUGGEST_REQUEST_DELAY_MS = 350;
const GOOGLE_TRENDS_TOP_LIMIT = 50;
const GOOGLE_TRENDS_RISING_LIMIT = 50;

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
  options: {
    forceRefresh?: boolean;
    cacheTtlHours?: number;
    requestDelayMs?: number;
    providerMode?: "suggest" | "trends";
    trendsTopLimit?: number;
    trendsRisingLimit?: number;
    trendsTimeframe?: string;
  } = {},
) {
  const forceRefresh = options.forceRefresh ?? false;
  const cacheTtlHours = options.cacheTtlHours ?? SUGGEST_CACHE_TTL_HOURS;
  const requestDelayMs = options.requestDelayMs ?? SUGGEST_REQUEST_DELAY_MS;
  const providerMode = options.providerMode ?? "trends";
  const trendsTopLimit = options.trendsTopLimit ?? GOOGLE_TRENDS_TOP_LIMIT;
  const trendsRisingLimit = options.trendsRisingLimit ?? GOOGLE_TRENDS_RISING_LIMIT;
  const trendsTimeframe = options.trendsTimeframe ?? "now 7-d";
  const providerLimit =
    providerMode === "trends" ? trendsTopLimit + trendsRisingLimit : limitPerKeyword;
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
      suggestResults: {
        where: {
          provider: {
            in:
              providerMode === "trends"
                ? ["google_trends_top", "google_trends_rising"]
                : ["google_suggest"],
          },
        },
        orderBy: [
          {
            fetchedAt: "desc",
          },
          {
            rank: "asc",
          },
        ],
        select: {
          suggestedKeywordId: true,
          fetchedAt: true,
          rank: true,
        },
      },
    },
  });

  if (parentKeywords.length === 0) {
    throw new Error("No matching primary keywords found for secondary generation");
  }

  const allCandidates: SecondaryKeywordCandidate[] = [];
  const parentKeywordsById = new Map(parentKeywords.map((keyword) => [keyword.id, keyword]));
  const failedQueries: string[] = [];
  const freshCandidatesByParent = new Map<number, SecondaryKeywordCandidate[]>();
  let cachedParentKeywordCount = 0;
  let fetchedParentKeywordCount = 0;
  const touchedSecondaryKeywordIds = new Set<number>();

  for (const parentKeyword of parentKeywords) {
    const recentCachedEntries = getRecentCachedSuggestResults(
      parentKeyword.suggestResults,
      cacheTtlHours,
      providerLimit,
    );

    if (!forceRefresh && recentCachedEntries.length > 0) {
      cachedParentKeywordCount += 1;
      recentCachedEntries.forEach((entry) => touchedSecondaryKeywordIds.add(entry.suggestedKeywordId));
      continue;
    }

    try {
      if (allCandidates.length > 0 || cachedParentKeywordCount > 0) {
        await sleep(requestDelayMs);
      }

      const providerCandidates =
        providerMode === "trends"
          ? await fetchGoogleTrendsRelatedQueryCandidates(
              parentKeyword.id,
              parentKeyword.text,
              parentKeyword.region,
              parentKeyword.language,
              {
                timeframe: trendsTimeframe,
                topLimit: trendsTopLimit,
                risingLimit: trendsRisingLimit,
              },
            )
          : await fetchGoogleSuggestCandidates(parentKeyword.id, parentKeyword.text);
      const limitedCandidates =
        providerMode === "trends"
          ? providerCandidates
          : providerCandidates.slice(0, limitPerKeyword);
      allCandidates.push(...limitedCandidates);
      freshCandidatesByParent.set(parentKeyword.id, limitedCandidates);
      fetchedParentKeywordCount += 1;
    } catch (error) {
      failedQueries.push(
        `${parentKeyword.text}: ${error instanceof Error ? error.message : "Unknown suggest error"}`,
      );
    }
  }

  if (allCandidates.length === 0 && touchedSecondaryKeywordIds.size === 0) {
    throw new Error(
      failedQueries.length > 0 && cachedParentKeywordCount === 0
        ? `Secondary keyword generation failed for all parent keywords. ${failedQueries
            .slice(0, 3)
            .join(" | ")}`
        : `No secondary keyword candidates returned from ${
            providerMode === "trends" ? "Google Trends" : "Google Suggest"
          }`,
    );
  }

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
        region: parentKeyword.region,
        language: parentKeyword.language,
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
        region: parentKeyword.region,
        language: parentKeyword.language,
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
  await cleanupStaleSecondaryKeywordRelations(
    parentKeywords,
    freshCandidatesByParent,
    providerMode,
    touchedSecondaryKeywordIds,
  );

  const evaluation = await summarizeSecondaryKeywordStatuses([...touchedSecondaryKeywordIds]);

  return {
    parentKeywordCount: parentKeywords.length,
    secondaryKeywordCount: allCandidates.length,
    acceptedSecondaryKeywordCount: evaluation.acceptedCount,
    blockedSecondaryKeywordCount: evaluation.blockedCount,
    cachedParentKeywordCount,
    fetchedParentKeywordCount,
    failedQueryCount: failedQueries.length,
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

function getRecentCachedSuggestResults(
  entries: Array<{
    suggestedKeywordId: number;
    fetchedAt: Date;
    rank: number;
  }>,
  cacheTtlHours: number,
  limitPerKeyword: number,
) {
  const minFetchedAt = Date.now() - cacheTtlHours * 60 * 60 * 1000;

  return entries
    .filter((entry) => entry.fetchedAt.getTime() >= minFetchedAt)
    .sort((left, right) => left.rank - right.rank)
    .slice(0, limitPerKeyword);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function cleanupStaleSecondaryKeywordRelations(
  parentKeywords: Array<{
    id: number;
  }>,
  freshCandidatesByParent: Map<number, SecondaryKeywordCandidate[]>,
  providerMode: "suggest" | "trends",
  touchedSecondaryKeywordIds: Set<number>,
) {
  const activeProviders =
    providerMode === "trends"
      ? ["google_trends_top", "google_trends_rising"]
      : ["google_suggest"];

  for (const parentKeyword of parentKeywords) {
    const currentCandidates = freshCandidatesByParent.get(parentKeyword.id);

    if (!currentCandidates) {
      continue;
    }

    const normalizedTexts = new Set(currentCandidates.map((candidate) => candidate.normalizedText));
    const existingRelations = await prisma.keywordSuggestResult.findMany({
      where: {
        parentKeywordId: parentKeyword.id,
        provider: {
          in: activeProviders,
        },
      },
      include: {
        suggestedKeyword: {
          select: {
            id: true,
            normalizedText: true,
            parentKeywordId: true,
          },
        },
      },
    });

    const staleKeywordIds = existingRelations
      .filter((relation) => !normalizedTexts.has(relation.suggestedKeyword.normalizedText))
      .map((relation) => relation.suggestedKeywordId);

    if (staleKeywordIds.length === 0) {
      continue;
    }

    await prisma.keywordSuggestResult.deleteMany({
      where: {
        parentKeywordId: parentKeyword.id,
        suggestedKeywordId: {
          in: staleKeywordIds,
        },
        provider: {
          in: activeProviders,
        },
      },
    });

    await prisma.keyword.updateMany({
      where: {
        id: {
          in: staleKeywordIds,
        },
        parentKeywordId: parentKeyword.id,
      },
      data: {
        status: KeywordStatus.blocked,
      },
    });

    staleKeywordIds.forEach((id) => touchedSecondaryKeywordIds.add(id));
  }
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
