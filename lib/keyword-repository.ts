import { KeywordLevel, KeywordStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeKeyword } from "@/lib/normalize";
import type { PrimaryKeywordCandidate } from "@/lib/types";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function upsertPrimaryKeywords(candidates: PrimaryKeywordCandidate[]) {
  const metricDate = startOfToday();
  const activeNormalizedTexts = candidates.map((candidate) =>
    normalizeKeyword(candidate.normalizedText),
  );

  await prisma.keyword.updateMany({
    where: {
      level: KeywordLevel.primary,
      isManual: false,
      normalizedText: {
        notIn: activeNormalizedTexts,
      },
    },
    data: {
      status: KeywordStatus.blocked,
    },
  });

  for (const candidate of candidates) {
    const keyword = await prisma.keyword.upsert({
      where: {
        normalizedText: normalizeKeyword(candidate.normalizedText),
      },
      update: {
        text: candidate.text,
        level: KeywordLevel.primary,
        sourceLabel: candidate.sourceIds.join(", "),
        sourceIdsRaw: candidate.sourceIds.join(","),
        lastSeenAt: new Date(),
        status: KeywordStatus.tracking,
      },
      create: {
        text: candidate.text,
        normalizedText: normalizeKeyword(candidate.normalizedText),
        level: KeywordLevel.primary,
        region: "KR",
        language: "ko",
        sourceLabel: candidate.sourceIds.join(", "),
        sourceIdsRaw: candidate.sourceIds.join(","),
        isManual: false,
        status: KeywordStatus.tracking,
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
        frequencyScore: candidate.frequencyScore,
        sourceCount: candidate.sourceCount,
        opportunityScore: candidate.opportunityScore,
        trendScore: candidate.sourceCount,
      },
      create: {
        keywordId: keyword.id,
        metricDate,
        frequencyScore: candidate.frequencyScore,
        sourceCount: candidate.sourceCount,
        opportunityScore: candidate.opportunityScore,
        trendScore: candidate.sourceCount,
      },
    });
  }
}

export async function setKeywordPinned(keywordId: number, pinned: boolean) {
  if (pinned) {
    const existing = await prisma.keyword.findUnique({
      where: { id: keywordId },
      select: { pinned: true, level: true },
    });

    if (!existing || existing.level !== KeywordLevel.primary) {
      throw new Error("Primary keyword not found");
    }

    if (!existing.pinned) {
      await assertPinnedPrimaryCapacity();
    }
  }

  await prisma.keyword.update({
    where: { id: keywordId },
    data: {
      pinned,
      pinnedAt: pinned ? new Date() : null,
    },
  });
}

type CreateManualPrimaryKeywordInput = {
  text: string;
  region?: string;
  language?: string;
};

type CreateManualSecondaryKeywordInput = {
  text: string;
  region?: string;
  language?: string;
  parentKeywordId?: number | null;
};

async function assertPinnedPrimaryCapacity() {
  const pinnedCount = await prisma.keyword.count({
    where: {
      level: KeywordLevel.primary,
      pinned: true,
      status: {
        in: [KeywordStatus.tracking, KeywordStatus.analyzed],
      },
    },
  });

  if (pinnedCount >= 30) {
    throw new Error("Pinned primary keyword limit reached (30)");
  }
}

export async function createManualPrimaryKeyword(input: string | CreateManualPrimaryKeywordInput) {
  const text = typeof input === "string" ? input : input.text;
  const region = typeof input === "string" ? "KR" : input.region ?? "KR";
  const language = typeof input === "string" ? "ko" : input.language ?? "ko";
  const normalizedText = normalizeKeyword(text);

  if (!normalizedText || normalizedText.length < 2) {
    throw new Error("Manual keyword must be at least 2 characters");
  }

  const existing = await prisma.keyword.findUnique({
    where: {
      normalizedText,
    },
    select: {
      pinned: true,
    },
  });

  if (!existing?.pinned) {
    await assertPinnedPrimaryCapacity();
  }

  const metricDate = startOfToday();
  const keyword = await prisma.keyword.upsert({
    where: {
      normalizedText,
    },
    update: {
      text,
      level: KeywordLevel.primary,
      region,
      language,
      sourceLabel: "manual",
      sourceIdsRaw: `manual:${region.toLowerCase()}`,
      isManual: true,
      pinned: true,
      pinnedAt: new Date(),
      lastSeenAt: new Date(),
      status: KeywordStatus.tracking,
    },
    create: {
      text,
      normalizedText,
      level: KeywordLevel.primary,
      region,
      language,
      sourceLabel: "manual",
      sourceIdsRaw: `manual:${region.toLowerCase()}`,
      isManual: true,
      pinned: true,
      pinnedAt: new Date(),
      status: KeywordStatus.tracking,
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
      frequencyScore: 1,
      sourceCount: 1,
      trendScore: 1,
      opportunityScore: Math.max(keyword.pinned ? 9 : 8, 8),
    },
    create: {
      keywordId: keyword.id,
      metricDate,
      frequencyScore: 1,
      sourceCount: 1,
      trendScore: 1,
      opportunityScore: 8,
    },
  });

  return keyword;
}

export async function createManualPrimaryKeywords(
  entries: Array<CreateManualPrimaryKeywordInput>,
) {
  const created = [];

  for (const entry of entries) {
    created.push(await createManualPrimaryKeyword(entry));
  }

  return created;
}

export async function createManualSecondaryKeyword(
  input: string | CreateManualSecondaryKeywordInput,
) {
  const text = typeof input === "string" ? input : input.text;
  const region = typeof input === "string" ? "KR" : input.region ?? "KR";
  const language = typeof input === "string" ? "ko" : input.language ?? "ko";
  const parentKeywordId = typeof input === "string" ? null : input.parentKeywordId ?? null;
  const normalizedText = normalizeKeyword(text);

  if (!normalizedText || normalizedText.length < 2) {
    throw new Error("Manual secondary keyword must be at least 2 characters");
  }

  const metricDate = startOfToday();
  const keyword = await prisma.keyword.upsert({
    where: {
      normalizedText,
    },
    update: {
      text,
      level: KeywordLevel.secondary,
      parentKeywordId,
      region,
      language,
      sourceLabel: "manual_secondary",
      sourceIdsRaw: `manual:${region.toLowerCase()}`,
      isManual: true,
      lastSeenAt: new Date(),
      status: KeywordStatus.tracking,
    },
    create: {
      text,
      normalizedText,
      level: KeywordLevel.secondary,
      parentKeywordId,
      region,
      language,
      sourceLabel: "manual_secondary",
      sourceIdsRaw: `manual:${region.toLowerCase()}`,
      isManual: true,
      status: KeywordStatus.tracking,
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
      frequencyScore: 1,
      sourceCount: 1,
      trendScore: 1,
      opportunityScore: 6,
    },
    create: {
      keywordId: keyword.id,
      metricDate,
      frequencyScore: 1,
      sourceCount: 1,
      trendScore: 1,
      opportunityScore: 6,
    },
  });

  return keyword;
}

export async function createManualSecondaryKeywords(
  entries: Array<CreateManualSecondaryKeywordInput>,
) {
  const created = [];

  for (const entry of entries) {
    created.push(await createManualSecondaryKeyword(entry));
  }

  return created;
}

export async function deleteManualPrimaryKeyword(keywordId: number) {
  const keyword = await prisma.keyword.findUnique({
    where: {
      id: keywordId,
    },
    select: {
      id: true,
      isManual: true,
      level: true,
    },
  });

  if (!keyword || keyword.level !== KeywordLevel.primary || !keyword.isManual) {
    throw new Error("Manual primary keyword not found");
  }

  await prisma.keyword.delete({
    where: {
      id: keywordId,
    },
  });
}

export async function getTopPrimaryKeywords(limit = 30) {
  return getPrimaryKeywords({ limit });
}

export type PrimaryKeywordQuery = {
  limit?: number;
  sort?: "opportunity" | "frequency" | "coverage" | "newest" | "alpha" | "pinned";
  sourceIds?: string[];
  pinnedOnly?: boolean;
  includeBlocked?: boolean;
};

type PrimaryKeywordRecord = Prisma.KeywordGetPayload<{
  include: {
    metrics: {
      orderBy: {
        metricDate: "desc";
      };
      take: 1;
    };
  };
}>;

export async function getPrimaryKeywords(query: PrimaryKeywordQuery = {}) {
  const {
    limit = 100,
    sort = "opportunity",
    sourceIds = [],
    pinnedOnly = false,
    includeBlocked = false,
  } = query;
  const keywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.primary,
      status: {
        in: includeBlocked
          ? [KeywordStatus.tracking, KeywordStatus.analyzed, KeywordStatus.blocked]
          : [KeywordStatus.tracking, KeywordStatus.analyzed],
      },
      ...(pinnedOnly ? { pinned: true } : {}),
    },
    include: {
      metrics: {
        orderBy: {
          metricDate: "desc",
        },
        take: 1,
      },
    },
    take: 300,
  });

  return keywords
    .filter((keyword) => {
      if (sourceIds.length === 0) {
        return true;
      }

      const keywordSourceIds = parseKeywordSourceIds(keyword.sourceIdsRaw);
      return sourceIds.some((sourceId) => keywordSourceIds.includes(sourceId));
    })
    .sort((left, right) => compareKeywords(left, right, sort))
    .slice(0, limit);
}

export async function getPinnedPrimaryKeywords(limit = 12) {
  return getPrimaryKeywords({
    limit,
    sort: "pinned",
    pinnedOnly: true,
  });
}

export async function getManualPrimaryKeywords(limit = 50) {
  const keywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.primary,
      isManual: true,
      status: {
        in: [KeywordStatus.tracking, KeywordStatus.analyzed],
      },
    },
    include: {
      metrics: {
        orderBy: {
          metricDate: "desc",
        },
        take: 1,
      },
    },
    take: 300,
  });

  return keywords.sort((left, right) => compareKeywords(left, right, "pinned")).slice(0, limit);
}

export async function getRecentSecondaryKeywords(limit = 40) {
  return prisma.keyword.findMany({
    where: {
      level: KeywordLevel.secondary,
      status: {
        in: [KeywordStatus.tracking, KeywordStatus.analyzed],
      },
    },
    include: {
      parentKeyword: true,
      metrics: {
        orderBy: {
          metricDate: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
  });
}

export type TertiaryKeywordQuery = {
  limit?: number;
  sort?: "opportunity" | "frequency" | "coverage" | "newest" | "alpha";
  sourceIds?: string[];
};

export async function getTertiaryKeywords(query: TertiaryKeywordQuery = {}) {
  const { limit = 150, sort = "opportunity", sourceIds = [] } = query;
  const keywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.tertiary,
      status: {
        in: [KeywordStatus.tracking, KeywordStatus.analyzed],
      },
    },
    include: {
      parentKeyword: {
        include: {
          analyses: {
            orderBy: {
              generatedAt: "desc",
            },
            take: 1,
          },
        },
      },
      metrics: {
        orderBy: {
          metricDate: "desc",
        },
        take: 1,
      },
    },
    take: 400,
  });

  return keywords
    .filter((keyword) => {
      if (sourceIds.length === 0) {
        return true;
      }

      const keywordSourceIds = parseKeywordSourceIds(keyword.sourceIdsRaw);
      return sourceIds.some((sourceId) => keywordSourceIds.includes(sourceId));
    })
    .sort((left, right) => compareKeywords(left, right, sort))
    .slice(0, limit);
}

export function parseKeywordSourceIds(sourceIdsRaw?: string | null) {
  return (sourceIdsRaw ?? "")
    .split(",")
    .map((sourceId) => sourceId.trim())
    .filter(Boolean);
}

export function isManualKeywordSource(sourceIdsRaw?: string | null) {
  return parseKeywordSourceIds(sourceIdsRaw).includes("manual");
}

function compareKeywords(
  left: PrimaryKeywordRecord,
  right: PrimaryKeywordRecord,
  sort: NonNullable<PrimaryKeywordQuery["sort"]>,
) {
  const leftMetric = left.metrics[0];
  const rightMetric = right.metrics[0];
  const leftOpportunity = leftMetric?.opportunityScore ?? 0;
  const rightOpportunity = rightMetric?.opportunityScore ?? 0;
  const leftFrequency = leftMetric?.frequencyScore ?? 0;
  const rightFrequency = rightMetric?.frequencyScore ?? 0;
  const leftCoverage = leftMetric?.sourceCount ?? 0;
  const rightCoverage = rightMetric?.sourceCount ?? 0;

  if (sort === "alpha") {
    return left.text.localeCompare(right.text, "ko");
  }

  if (sort === "newest") {
    return right.lastSeenAt.getTime() - left.lastSeenAt.getTime();
  }

  if (sort === "frequency" && rightFrequency !== leftFrequency) {
    return rightFrequency - leftFrequency;
  }

  if (sort === "coverage" && rightCoverage !== leftCoverage) {
    return rightCoverage - leftCoverage;
  }

  if (sort === "pinned") {
    const pinnedTimeDelta =
      (right.pinnedAt?.getTime() ?? 0) - (left.pinnedAt?.getTime() ?? 0);

    if (pinnedTimeDelta !== 0) {
      return pinnedTimeDelta;
    }
  }

  if (rightOpportunity !== leftOpportunity) {
    return rightOpportunity - leftOpportunity;
  }

  if (rightCoverage !== leftCoverage) {
    return rightCoverage - leftCoverage;
  }

  return rightFrequency - leftFrequency;
}
