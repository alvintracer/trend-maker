import { GeneratedPageStatus, KeywordLevel, KeywordStatus } from "@prisma/client";
import * as cheerio from "cheerio";

import { normalizeKeyword } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

const NAMU_AV_INFO_URL = "https://namu.wiki/w/AV%20%EB%B0%B0%EC%9A%B0%20%EC%A0%95%EB%B3%B4";
const ACTIVE_INITIALS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;
export const NAMU_AV_ACTIVE_INITIALS = ACTIVE_INITIALS;

export type SupportedInitial = (typeof ACTIVE_INITIALS)[number];

const JAMO_SLUG_MAP: Record<string, string> = {
  ㄱ: "g", ㄴ: "n", ㄷ: "d", ㄹ: "r", ㅁ: "m",
  ㅂ: "b", ㅅ: "s", ㅇ: "o", ㅈ: "j", ㅊ: "c",
  ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "h",
};

function slugifyKeyword(value: string) {
  const jamoReplaced = [...value].map((ch) => JAMO_SLUG_MAP[ch] ?? ch).join("");
  return jamoReplaced
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶー一-龯\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildBodyParagraphs(initial: SupportedInitial, names: string[]) {
  const headlineNames = names.slice(0, 16);
  const middleNames = names.slice(16, 32);
  const tailNames = names.slice(32, 48);

  return [
    `나무위키 AV 배우 정보 문서의 여배우 (${initial}) 구간을 기준으로 최신 이름 묶음을 정리했습니다. 이 페이지는 해당 초성 구간에 실제로 링크된 배우 이름을 바로 훑어볼 수 있게 구성한 목록형 허브입니다.`,
    headlineNames.length > 0
      ? `가장 앞쪽에 배치된 이름들로는 ${headlineNames.join(", ")} 등이 확인됩니다. 초성 ${initial} 구간에서 바로 찾는 용도로 먼저 보는 묶음입니다.`
      : `현재 초성 ${initial} 구간에서는 활성 이름 묶음을 찾지 못했습니다. 문서 구조 변경 또는 항목 공백 가능성이 있어 다음 동기화 때 다시 확인하는 편이 좋습니다.`,
    middleNames.length > 0
      ? `같은 구간의 추가 이름으로는 ${middleNames.join(", ")} 등이 이어집니다. 문서 링크 기준으로 수집했기 때문에 실제 나무위키 문서가 연결된 이름만 포함됩니다.`
      : `중간 구간에 추가로 노출된 이름은 아직 많지 않습니다.`,
    tailNames.length > 0
      ? `후반부에는 ${tailNames.join(", ")} 같은 이름도 포함되어 있습니다. 초성별 묶음을 주기적으로 갱신하면 누락 없이 따라가기 쉽습니다.`
      : `후반부 추가 이름은 많지 않아 현재는 앞쪽 링크 중심으로 요약했습니다.`,
  ];
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function fetchNamuAvInfoHtml() {
  const response = await fetch(NAMU_AV_INFO_URL, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "ko-KR,ko;q=0.9",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`나무위키 페이지 로드 실패 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`);
  }

  return response.text();
}

function parseNamuActorGroups(html: string) {
  const $ = cheerio.load(html);
  const groups = new Map<SupportedInitial, Array<{ text: string; href: string }>>();

  for (const initial of ACTIVE_INITIALS) {
    groups.set(initial, []);
  }

  const anchors = $("a").toArray();
  const sections = ACTIVE_INITIALS.map((initial) => {
    const heading = $("span[id]").filter((_, element) => {
      const id = ($(element).attr("id") ?? "").trim();
      return id === `여배우 (${initial})`;
    }).first();
    const sectionId = heading.prev("a").attr("id");
    const anchorIndex = sectionId
      ? anchors.findIndex((element) => $(element).attr("id") === sectionId)
      : -1;
    return {
      initial,
      sectionId,
      anchorIndex,
    };
  })
    .filter(
      (entry): entry is { initial: SupportedInitial; sectionId: string; anchorIndex: number } =>
        Boolean(entry.sectionId) && entry.anchorIndex >= 0,
    )
    .sort((left, right) => left.anchorIndex - right.anchorIndex);

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const initial = sections[sectionIndex].initial;
    const startAnchorIndex = sections[sectionIndex].anchorIndex;
    const nextAnchorIndex = sections[sectionIndex + 1]?.anchorIndex;
    const endAnchorIndex =
      typeof nextAnchorIndex === "number"
        ? nextAnchorIndex
      : anchors.length;
    const sectionAnchors = anchors.slice(
      startAnchorIndex + 1,
      endAnchorIndex,
    );
    const target = groups.get(initial);

    if (!target) {
      continue;
    }

    for (const element of sectionAnchors) {
      const href = $(element).attr("href") ?? "";
      const text = $(element).text().replace(/\s+/g, " ").trim();

      if (!href.startsWith("/w/") || !text || text.includes("편집") || text.length > 40) {
        continue;
      }

      if (target.some((item) => item.text === text)) {
        continue;
      }

      target.push({
        text,
        href: new URL(href, NAMU_AV_INFO_URL).toString(),
      });
    }
  }

  return groups;
}

export async function getNamuAvActorInitialPreview(initial: SupportedInitial) {
  const html = await fetchNamuAvInfoHtml();
  const groups = parseNamuActorGroups(html);
  return groups.get(initial) ?? [];
}

export async function syncNamuAvActorInitialPage(initial: SupportedInitial, htmlOverride?: string) {
  const html = htmlOverride ?? (await fetchNamuAvInfoHtml());
  const groups = parseNamuActorGroups(html);
  const actors = groups.get(initial) ?? [];
  const keywordText = `AV 배우 이름 초성 모음 ${initial}`;
  const legacyKeywordText = `AV 배우 정보 ${initial}`;
  const normalizedText = normalizeKeyword(keywordText);
  const legacyNormalizedText = normalizeKeyword(legacyKeywordText);
  const slug = slugifyKeyword(`av-배우-이름-초성-모음-${initial}`);
  const actorNames = actors.map((actor) => actor.text);
  const bodyParagraphs = buildBodyParagraphs(initial, actorNames);
  const canonicalPath = `/keywords/${slug}`;
  const metricDate = startOfToday();
  const existingKeywords = await prisma.keyword.findMany({
    where: {
      normalizedText: {
        in: [normalizedText, legacyNormalizedText],
      },
    },
    orderBy: {
      id: "asc",
    },
  });
  const existingKeyword =
    existingKeywords.find((entry) => entry.normalizedText === normalizedText) ??
    existingKeywords.find((entry) => entry.normalizedText === legacyNormalizedText) ??
    null;
  const keywordData = {
    text: keywordText,
    normalizedText,
    level: KeywordLevel.primary,
    region: "JP",
    language: "ko",
    isManual: true,
    sourceLabel: "namu_wiki",
    sourceIdsRaw: "manual:namu",
    status: KeywordStatus.tracking,
    lastSeenAt: new Date(),
  };

  const keyword = existingKeyword
    ? await prisma.keyword.update({
        where: {
          id: existingKeyword.id,
        },
        data: keywordData,
      })
    : await prisma.keyword.create({
        data: keywordData,
      });

  await prisma.keywordMetric.upsert({
    where: {
      keywordId_metricDate: {
        keywordId: keyword.id,
        metricDate,
      },
    },
    update: {
      frequencyScore: Math.max(actorNames.length, 1),
      sourceCount: 1,
      trendScore: 1,
      opportunityScore: 18,
    },
    create: {
      keywordId: keyword.id,
      metricDate,
      frequencyScore: Math.max(actorNames.length, 1),
      sourceCount: 1,
      trendScore: 1,
      opportunityScore: 18,
    },
  });

  for (const actorName of actorNames) {
    const actorKeyword = await prisma.keyword.upsert({
      where: {
        normalizedText: normalizeKeyword(actorName),
      },
      update: {
        text: actorName,
        level: KeywordLevel.secondary,
        parentKeywordId: keyword.id,
        region: "JP",
        language: "ko",
        isManual: true,
        sourceLabel: "namu_wiki_actor",
        sourceIdsRaw: "manual:namu",
        status: KeywordStatus.tracking,
        lastSeenAt: new Date(),
      },
      create: {
        text: actorName,
        normalizedText: normalizeKeyword(actorName),
        level: KeywordLevel.secondary,
        parentKeywordId: keyword.id,
        region: "JP",
        language: "ko",
        isManual: true,
        sourceLabel: "namu_wiki_actor",
        sourceIdsRaw: "manual:namu",
        status: KeywordStatus.tracking,
      },
    });

    await prisma.keywordMetric.upsert({
      where: {
        keywordId_metricDate: {
          keywordId: actorKeyword.id,
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
        keywordId: actorKeyword.id,
        metricDate,
        frequencyScore: 1,
        sourceCount: 1,
        trendScore: 1,
        opportunityScore: 6,
      },
    });
  }

  await prisma.keyword.deleteMany({
    where: {
      parentKeywordId: keyword.id,
      sourceLabel: "namu_wiki_actor",
      text: {
        notIn: actorNames.length > 0 ? actorNames : [""],
      },
    },
  });

  await prisma.generatedPage.upsert({
    where: {
      keywordId: keyword.id,
    },
    update: {
      slug,
      title: keywordText,
      h1: keywordText,
      description: `나무위키 AV 배우 정보 문서에서 ${initial} 초성 구간에 포함된 실제 배우 이름을 모아 정리한 페이지입니다.`,
      summary: `나무위키 AV 배우 정보 문서의 ${initial} 초성 링크 목록을 기준으로 실제 배우 이름 묶음과 대표 항목 흐름을 한 페이지에 정리했습니다.`,
      faqRaw: JSON.stringify(bodyParagraphs),
      relatedKeywordsRaw: JSON.stringify(actorNames.slice(0, 80)),
      canonicalPath,
      status: GeneratedPageStatus.published,
      lastGeneratedAt: new Date(),
    },
    create: {
      keywordId: keyword.id,
      slug,
      title: keywordText,
      h1: keywordText,
      description: `나무위키 AV 배우 정보 문서에서 ${initial} 초성 구간에 포함된 실제 배우 이름을 모아 정리한 페이지입니다.`,
      summary: `나무위키 AV 배우 정보 문서의 ${initial} 초성 링크 목록을 기준으로 실제 배우 이름 묶음과 대표 항목 흐름을 한 페이지에 정리했습니다.`,
      faqRaw: JSON.stringify(bodyParagraphs),
      relatedKeywordsRaw: JSON.stringify(actorNames.slice(0, 80)),
      canonicalPath,
      status: GeneratedPageStatus.published,
      lastGeneratedAt: new Date(),
    },
  });

  return {
    initial,
    actorCount: actors.length,
    sample: actorNames.slice(0, 12),
    canonicalPath,
  };
}

export async function syncAllNamuAvActorInitialPages(htmlOverride?: string) {
  const synced = [];
  const html = htmlOverride ?? (await fetchNamuAvInfoHtml());

  for (const initial of ACTIVE_INITIALS) {
    synced.push(await syncNamuAvActorInitialPage(initial, html));
  }

  const activeLegacyTexts = new Set(ACTIVE_INITIALS.map((initial) => `AV 배우 정보 ${initial}`));
  const activeCurrentTexts = new Set(ACTIVE_INITIALS.map((initial) => `AV 배우 이름 초성 모음 ${initial}`));
  const currentKeywords = await prisma.keyword.findMany({
    where: {
      text: {
        in: [...activeCurrentTexts],
      },
    },
    select: {
      id: true,
      text: true,
    },
  });
  const currentKeywordIdByText = new Map(currentKeywords.map((keyword) => [keyword.text, keyword.id]));
  const legacyKeywords = await prisma.keyword.findMany({
    where: {
      text: {
        in: [...activeLegacyTexts],
      },
    },
    include: {
      generatedPages: {
        select: {
          id: true,
        },
      },
      childKeywords: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  let deletedKeywordCount = 0;
  let deletedPageCount = 0;
  let reassignedChildCount = 0;

  for (const legacyKeyword of legacyKeywords) {
    const initial = legacyKeyword.text.slice(-1) as SupportedInitial;
    const targetText = `AV 배우 이름 초성 모음 ${initial}`;
    const targetKeywordId = currentKeywordIdByText.get(targetText);

    if (targetKeywordId && targetKeywordId !== legacyKeyword.id) {
      if (legacyKeyword.childKeywords.length > 0) {
        await prisma.keyword.updateMany({
          where: {
            parentKeywordId: legacyKeyword.id,
          },
          data: {
            parentKeywordId: targetKeywordId,
          },
        });
        reassignedChildCount += legacyKeyword.childKeywords.length;
      }

      if (legacyKeyword.generatedPages.length > 0) {
        await prisma.generatedPage.deleteMany({
          where: {
            keywordId: legacyKeyword.id,
          },
        });
        deletedPageCount += legacyKeyword.generatedPages.length;
      }

      await prisma.keyword.delete({
        where: {
          id: legacyKeyword.id,
        },
      });
      deletedKeywordCount += 1;
      continue;
    }

    if (!targetKeywordId) {
      if (legacyKeyword.generatedPages.length > 0) {
        await prisma.generatedPage.deleteMany({
          where: {
            keywordId: legacyKeyword.id,
          },
        });
        deletedPageCount += legacyKeyword.generatedPages.length;
      }

      if (legacyKeyword.childKeywords.length > 0) {
        await prisma.keyword.deleteMany({
          where: {
            parentKeywordId: legacyKeyword.id,
          },
        });
      }

      await prisma.keyword.delete({
        where: {
          id: legacyKeyword.id,
        },
      });
      deletedKeywordCount += 1;
    }
  }

  return {
    synced,
    deletedKeywordCount,
    deletedPageCount,
    reassignedChildCount,
  };
}
