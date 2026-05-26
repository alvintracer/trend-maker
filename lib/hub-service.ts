import { HubStatus, KeywordLevel, KeywordStatus } from "@prisma/client";

import { parseKeywordSourceIds } from "@/lib/keyword-repository";
import { normalizeKeywordLoose, normalizeWhitespace } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

function slugifyKeyword(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type ClusterCandidate = {
  id: number;
  text: string;
  normalizedText: string;
  parentKeywordId: number | null;
  parentKeyword: {
    text: string;
    normalizedText: string;
  } | null;
  sourceIdsRaw: string | null;
  status: KeywordStatus;
  lastSeenAt: Date;
  metrics: Array<{
    opportunityScore: number;
  }>;
  analyses: Array<{
    summary: string | null;
  }>;
};

const HUB_STOPWORDS = new Set([
  "메시지",
  "검색",
  "홈페이지",
  "주소",
  "링크",
  "사이트",
  "공식",
]);

const HUB_RULES = {
  minRepresentativeScore: 12,
  readyRepresentativeScore: 18,
} as const;

function tokenizeHubText(value: string) {
  return normalizeWhitespace(value)
    .replace(/[\[\]\(\)\{\}<>\.,!?;:"'`~@#$%^&*_+=|\\/]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function getHubStem(keyword: ClusterCandidate) {
  const tokens = tokenizeHubText(keyword.text);

  if (tokens.length === 0) {
    return keyword.normalizedText;
  }

  if (tokens.length === 1) {
    return keyword.normalizedText;
  }

  return normalizeKeywordLoose(tokens.slice(0, 2).join(" "));
}

function getRepresentativeQualityScore(candidate: ClusterCandidate) {
  const opportunity = candidate.metrics[0]?.opportunityScore ?? 0;
  const tokenCount = tokenizeHubText(candidate.text).length;
  const hasAnalysis = candidate.analyses.length > 0;
  const firstToken = tokenizeHubText(candidate.text)[0]?.toLowerCase() ?? "";
  const boundedParentMatch = hasBoundedParentMatch(candidate);

  let score = opportunity;

  if (candidate.status === KeywordStatus.analyzed) {
    score += 6;
  }

  if (hasAnalysis) {
    score += 4;
  }

  if (boundedParentMatch) {
    score += 3;
  }

  if (tokenCount >= 2) {
    score += 4;
  } else {
    score -= 3;
  }

  if (HUB_STOPWORDS.has(firstToken) || HUB_STOPWORDS.has(candidate.text.toLowerCase())) {
    score -= 10;
  }

  return score;
}

function isNoiseHubCandidate(candidate: ClusterCandidate) {
  const text = candidate.text.toLowerCase();
  const tokens = tokenizeHubText(candidate.text);
  const score = getRepresentativeQualityScore(candidate);

  if (text.includes("http://") || text.includes("https://") || text.includes("www.")) {
    return true;
  }

  if (/\.(com|net|org|co|kr)\b/.test(text)) {
    return true;
  }

  if (HUB_STOPWORDS.has(text)) {
    return true;
  }

  if (tokens.length === 1 && candidate.status !== KeywordStatus.analyzed && score < 16) {
    return true;
  }

  return false;
}

function hasBoundedParentMatch(candidate: ClusterCandidate) {
  const parentText = candidate.parentKeyword?.text;

  if (!parentText) {
    return false;
  }

  const normalizedParent = normalizeWhitespace(parentText);
  const normalizedText = normalizeWhitespace(candidate.text);

  return (
    normalizedText === normalizedParent ||
    normalizedText.startsWith(`${normalizedParent} `) ||
    normalizedText.includes(` ${normalizedParent} `) ||
    normalizedText.endsWith(` ${normalizedParent}`)
  );
}

function getRepresentativeKeyword(candidates: ClusterCandidate[]) {
  return [...candidates].sort((left, right) => {
    const leftScore = getRepresentativeQualityScore(left);
    const rightScore = getRepresentativeQualityScore(right);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    if (right.analyses.length !== left.analyses.length) {
      return right.analyses.length - left.analyses.length;
    }

    return right.lastSeenAt.getTime() - left.lastSeenAt.getTime();
  })[0];
}

export async function clusterSecondaryKeywords(keywordIds?: number[]) {
  const keywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.secondary,
      status: {
        in: [KeywordStatus.tracking, KeywordStatus.analyzed],
      },
      ...(keywordIds && keywordIds.length > 0
        ? {
            id: {
              in: keywordIds,
            },
          }
        : {}),
    },
    include: {
      parentKeyword: {
        select: {
          text: true,
          normalizedText: true,
        },
      },
      metrics: {
        orderBy: {
          metricDate: "desc",
        },
        take: 1,
      },
      analyses: {
        orderBy: {
          generatedAt: "desc",
        },
        take: 1,
      },
    },
  });

  const groups = new Map<string, typeof keywords>();

  for (const keyword of keywords) {
    const hubStem = getHubStem(keyword);
    const groupKey = keyword.parentKeywordId
      ? `primary:${keyword.parentKeywordId}:stem:${hubStem}`
      : `secondary:${hubStem}`;
    const current = groups.get(groupKey) ?? [];
    current.push(keyword);
    groups.set(groupKey, current);
  }

  let hubCount = 0;
  let mappedKeywordCount = 0;
  const retainedNormalizedNames = new Set<string>();

  for (const candidates of groups.values()) {
    const representative = getRepresentativeKeyword(candidates);
    const representativeScore = getRepresentativeQualityScore(representative);

    if (
      representativeScore < HUB_RULES.minRepresentativeScore ||
      isNoiseHubCandidate(representative)
    ) {
      continue;
    }

    const sourceIds = [
      ...new Set(candidates.flatMap((keyword) => parseKeywordSourceIds(keyword.sourceIdsRaw))),
    ];
    const hub = await prisma.hub.upsert({
      where: {
        normalizedName: getHubStem(representative),
      },
      update: {
        slug: slugifyKeyword(getHubStem(representative)),
        name: representative.text,
        summary: representative.analyses[0]?.summary ?? null,
        primaryKeywordId: representative.parentKeywordId,
        representativeKeywordId: representative.id,
        status:
          representativeScore >= HUB_RULES.readyRepresentativeScore
            ? HubStatus.ready
            : HubStatus.draft,
        lastComputedAt: new Date(),
      },
      create: {
        slug: slugifyKeyword(getHubStem(representative)),
        name: representative.text,
        normalizedName: getHubStem(representative),
        summary: representative.analyses[0]?.summary ?? null,
        primaryKeywordId: representative.parentKeywordId,
        representativeKeywordId: representative.id,
        status:
          representativeScore >= HUB_RULES.readyRepresentativeScore
            ? HubStatus.ready
            : HubStatus.draft,
      },
    });
    retainedNormalizedNames.add(hub.normalizedName);

    await prisma.keyword.updateMany({
      where: {
        id: {
          in: candidates.map((keyword) => keyword.id),
        },
      },
      data: {
        hubId: hub.id,
        sourceIdsRaw: sourceIds.join(","),
      },
    });

    hubCount += 1;
    mappedKeywordCount += candidates.length;
  }

  if (!keywordIds || keywordIds.length === 0) {
    await prisma.hub.deleteMany({
      where: {
        normalizedName: {
          notIn: [...retainedNormalizedNames],
        },
      },
    });
  }

  return {
    hubCount,
    mappedKeywordCount,
  };
}

export async function getHubInventory(limit = 150, sourceIds: string[] = []) {
  const hubs = await prisma.hub.findMany({
    include: {
      primaryKeyword: true,
      representativeKeyword: {
        include: {
          metrics: {
            orderBy: {
              metricDate: "desc",
            },
            take: 1,
          },
          analyses: {
            orderBy: {
              generatedAt: "desc",
            },
            take: 1,
          },
        },
      },
      secondaryKeywords: {
        include: {
          childKeywords: {
            where: {
              level: KeywordLevel.tertiary,
            },
            select: {
              id: true,
            },
          },
        },
      },
      generatedPage: true,
    },
    orderBy: [{ lastComputedAt: "desc" }],
    take: limit,
  });

  return hubs.filter((hub) => {
    if (sourceIds.length === 0) {
      return true;
    }

    const hubSourceIds = [
      ...new Set(
        hub.secondaryKeywords.flatMap((keyword) => parseKeywordSourceIds(keyword.sourceIdsRaw)),
      ),
    ];

    return sourceIds.some((sourceId) => hubSourceIds.includes(sourceId));
  });
}
