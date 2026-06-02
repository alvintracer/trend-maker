import { GeneratedPageStatus, KeywordLevel, KeywordStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const DCBEST_SOURCE_ID = "dcinside-dcbest";
const DEFAULT_DOC_SAMPLE_SIZE = 5;

function slugifyKeyword(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶー一-龯\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveGeneratedPageSlug(keywordId: number, normalizedText: string) {
  const baseSlug = slugifyKeyword(normalizedText) || `keyword-${keywordId}`;
  const candidateSlugs = [baseSlug, `${baseSlug}-${keywordId}`];
  const existingPages = await prisma.generatedPage.findMany({
    where: {
      slug: {
        in: candidateSlugs,
      },
    },
    select: {
      slug: true,
      keywordId: true,
    },
  });

  const existingBySlug = new Map(existingPages.map((page) => [page.slug, page.keywordId]));

  for (const slug of candidateSlugs) {
    const ownerKeywordId = existingBySlug.get(slug);

    if (!ownerKeywordId || ownerKeywordId === keywordId) {
      return slug;
    }
  }

  let suffix = 2;

  while (suffix < 10_000) {
    const slug = `${baseSlug}-${suffix}`;
    const existing = await prisma.generatedPage.findUnique({
      where: {
        slug,
      },
      select: {
        keywordId: true,
      },
    });

    if (!existing || existing.keywordId === keywordId) {
      return slug;
    }

    suffix += 1;
  }

  return `${baseSlug}-${keywordId}`;
}

function parseStringArray(value?: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function tokenizeKeyword(value: string) {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function seededShuffle<T>(items: T[], seedInput: string) {
  const itemsCopy = [...items];
  let seed = 0;

  for (const char of seedInput) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }

  for (let index = itemsCopy.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [itemsCopy[index], itemsCopy[swapIndex]] = [itemsCopy[swapIndex], itemsCopy[index]];
  }

  return itemsCopy;
}

function truncate(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function parseDcBestContentBlock(rawContent: string) {
  const lines = rawContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const fieldMap = new Map<string, string>();

  for (const line of lines) {
    const delimiterIndex = line.indexOf(":");

    if (delimiterIndex <= 0) {
      continue;
    }

    const key = line.slice(0, delimiterIndex).trim();
    const value = line.slice(delimiterIndex + 1).trim();

    if (key && value) {
      fieldMap.set(key, value);
    }
  }

  return {
    title: fieldMap.get("title") ?? "",
    comments: fieldMap.get("comments") ?? "",
    author: fieldMap.get("author") ?? "",
    date: fieldMap.get("date") ?? "",
    views: fieldMap.get("views") ?? "",
    recommends: fieldMap.get("recommends") ?? "",
    row: fieldMap.get("row") ?? rawContent.replace(/\s+/g, " ").trim(),
  };
}

async function getDcbestSourceId() {
  const source = await prisma.source.findUnique({
    where: {
      externalId: DCBEST_SOURCE_ID,
    },
    select: {
      id: true,
    },
  });

  return source?.id ?? null;
}

async function getDcBestRawDocuments() {
  const sourceId = await getDcbestSourceId();

  if (!sourceId) {
    return [];
  }

  return prisma.rawDocument.findMany({
    where: {
      sourceId,
    },
    orderBy: [{ crawledAt: "desc" }],
    take: 400,
  });
}

function selectSupportingDocuments(
  documents: Array<{ title: string | null; content: string; url: string }>,
  keywordText: string,
  relatedKeywords: string[],
) {
  const tokens = new Set([
    ...tokenizeKeyword(keywordText),
    ...relatedKeywords.flatMap((keyword) => tokenizeKeyword(keyword)),
  ]);

  const scored = documents.map((document) => {
    const haystack = `${document.title ?? ""}\n${document.content}`.toLowerCase();
    let score = 0;

    for (const token of tokens) {
      if (haystack.includes(token.toLowerCase())) {
        score += token.length >= 4 ? 3 : 2;
      }
    }

    if ((document.title ?? "").includes(keywordText)) {
      score += 4;
    }

    return {
      ...document,
      score,
    };
  });

  const prioritized = scored
    .filter((document) => document.score > 0)
    .sort((left, right) => right.score - left.score);

  const fallback = scored.filter((document) => document.score === 0);
  const pool =
    prioritized.length >= DEFAULT_DOC_SAMPLE_SIZE
      ? prioritized
      : [...prioritized, ...seededShuffle(fallback, keywordText)];

  return seededShuffle(pool.slice(0, Math.max(DEFAULT_DOC_SAMPLE_SIZE, prioritized.length)), keywordText).slice(
    0,
    DEFAULT_DOC_SAMPLE_SIZE,
  );
}

function buildPageCopy(input: {
  keywordText: string;
  secondaryKeywords: string[];
  docs: Array<{ title: string | null; content: string; url: string }>;
  sourceLabel?: string | null;
}) {
  if (input.sourceLabel === "namu_wiki") {
    const visibleNames = input.secondaryKeywords.slice(0, 48);
    const leadingNames = visibleNames.slice(0, 16);
    const trailingNames = visibleNames.slice(16, 32);
    const emphasizedNames = visibleNames.slice(0, 6);

    return {
      sampledDocs: [],
      title: truncate(`${input.keywordText}`, 60),
      description: truncate(
        `${input.keywordText} 페이지에서 ${emphasizedNames.join(", ") || "실제 배우 이름"}처럼 함께 묶이는 실제 AV 배우 이름을 초성별로 정리합니다.`,
        110,
      ),
      summary: truncate(
        `${input.keywordText}에 포함된 실제 배우 이름과 초성별 대표 항목 흐름을 한 페이지에서 빠르게 훑어볼 수 있도록 정리했습니다. ${emphasizedNames.join(", ") || "실제 배우 이름"} 같은 세부 이름도 본문과 메타 설명에 함께 반영합니다.`,
        220,
      ),
      bodyParagraphs: [
        truncate(
          `${input.keywordText} 페이지는 나무위키 문서에 실제로 연결된 이름만 추려서 보여주는 초성 목록형 페이지입니다. 페이지 헤더는 초성 모음 자체를 쓰고, 실제 배우 이름은 본문과 관련 키워드 영역에 모두 노출되도록 구성했습니다.`,
          320,
        ),
        truncate(
          leadingNames.length > 0
            ? `앞쪽에 배치된 이름으로는 ${leadingNames.join(", ")} 등이 있습니다. 특정 배우를 찾는 용도라면 먼저 이 묶음을 확인하면 됩니다.`
            : `${input.keywordText} 구간의 이름 목록을 아직 확인하지 못했습니다.`,
          320,
        ),
        truncate(
          trailingNames.length > 0
            ? `같은 초성 구간에는 ${trailingNames.join(", ")} 같은 이름도 이어집니다. 이름 데이터는 페이지 본문뿐 아니라 메타 설명과 관련 키워드에도 함께 반영됩니다.`
            : `현재는 앞쪽 이름 묶음 중심으로 정리되어 있습니다.`,
          320,
        ),
      ],
      evidenceSnippets: visibleNames.slice(0, 24),
    };
  }

  const sampledDocs = selectSupportingDocuments(
    input.docs,
    input.keywordText,
    input.secondaryKeywords,
  );
  const parsedDocs = sampledDocs.map((document) => parseDcBestContentBlock(document.content));
  const emphasizedSecondaries = input.secondaryKeywords.slice(0, 8);
  const descriptionKeywords = emphasizedSecondaries.slice(0, 4);

  const title = truncate(
    `${input.keywordText} 커뮤니티 반응 - 실시간 인기글 & 트렌드`,
    60,
  );
  const description = truncate(
    `${input.keywordText} 관련 ${descriptionKeywords.join(", ") || "연관 키워드"} 등 커뮤니티 실시간 인기글과 반응을 정리했습니다. | 커뮤니티위키코리아`,
    155,
  );
  const summary = truncate(
    `${input.keywordText} 키워드가 현재 커뮤니티에서 화제입니다. ${emphasizedSecondaries.join(", ") || input.keywordText} 같은 세부 키워드와 함께 디시인사이드 실시간베스트 기준으로 최근 반응을 정리했습니다.`,
    220,
  );
  const bodyParagraphs = [
    truncate(
      `${input.keywordText} 키워드가 현재 디시인사이드, 에펨코리아 등 주요 커뮤니티에서 동시에 화제가 되고 있습니다. ${emphasizedSecondaries.length > 0 ? `관련 검색어로는 ${emphasizedSecondaries.join(", ")} 등이 함께 언급되고 있으며, ` : ""}아래는 실시간베스트 기준 최근 인기글 반응입니다.`,
      320,
    ),
    ...parsedDocs.map((item, index) =>
      truncate(
        `${index + 1}. "${item.title || input.keywordText}" — 작성일 ${item.date || "최근"}, 조회수 ${item.views || "확인 중"}, 추천 ${item.recommends || "확인 중"}. ${input.keywordText} 관련 커뮤니티 반응을 보여주는 실시간 인기글입니다.`,
        320,
      ),
    ),
    truncate(
      `${input.keywordText}와 함께 자주 검색되는 키워드로는 ${emphasizedSecondaries.join(", ") || input.keywordText} 등이 있습니다. 커뮤니티위키코리아에서는 이러한 트렌드 키워드의 실시간 반응과 인기글을 지속적으로 업데이트하고 있습니다.`,
      320,
    ),
  ].filter(Boolean);

  const evidenceSnippets = parsedDocs.map((item) =>
    truncate(
      `${item.title || input.keywordText} | ${item.author || "익명"} | ${item.date || "최근"} | 조회 ${item.views || "-"} | 추천 ${item.recommends || "-"}`,
      160,
    ),
  );

  return {
    sampledDocs,
    title,
    description,
    summary,
    bodyParagraphs,
    evidenceSnippets,
  };
}

export async function generatePagesForKeywords(keywordIds: number[]) {
  const [keywords, dcBestDocs] = await Promise.all([
    prisma.keyword.findMany({
      where: {
        id: {
          in: keywordIds,
        },
        level: KeywordLevel.primary,
        status: {
          in: [KeywordStatus.analyzed, KeywordStatus.tracking],
        },
      },
      include: {
        childKeywords: {
          where: {
            level: KeywordLevel.secondary,
          },
          include: {
            metrics: {
              orderBy: {
                metricDate: "desc",
              },
              take: 1,
            },
          },
          take: 80,
        },
        metrics: {
          orderBy: {
            metricDate: "desc",
          },
          take: 1,
        },
      },
    }),
    getDcBestRawDocuments(),
  ]);

  if (keywords.length === 0) {
    throw new Error("No eligible primary keywords found for page generation");
  }

  const requiresDcBestDocs = keywords.some((keyword) => keyword.sourceLabel !== "namu_wiki");

  if (requiresDcBestDocs && dcBestDocs.length === 0) {
    throw new Error("No DCBest raw documents available for page composition");
  }

  let generatedCount = 0;

  for (const keyword of keywords) {
    const secondaryKeywords = keyword.childKeywords
      .slice()
      .sort(
        (left, right) =>
          (right.metrics[0]?.opportunityScore ?? 0) - (left.metrics[0]?.opportunityScore ?? 0),
      )
      .map((child) => child.text);
    const relatedKeywords = [
      ...secondaryKeywords,
      ...secondaryKeywords.flatMap((child) => tokenizeKeyword(child)),
    ].filter((value, index, array) => array.indexOf(value) === index);
    const pageCopy = buildPageCopy({
      keywordText: keyword.text,
      secondaryKeywords,
      docs: dcBestDocs,
      sourceLabel: keyword.sourceLabel,
    });
    const slug = await resolveGeneratedPageSlug(keyword.id, keyword.normalizedText);
    const canonicalPath = `/keywords/${slug}`;

    await prisma.generatedPage.upsert({
      where: {
        keywordId: keyword.id,
      },
      update: {
        slug,
        title: pageCopy.title,
        description: pageCopy.description,
        h1: keyword.text,
        summary: pageCopy.summary,
        faqRaw: JSON.stringify(pageCopy.bodyParagraphs),
        relatedKeywordsRaw: JSON.stringify([
          ...relatedKeywords.slice(0, 10),
          ...pageCopy.evidenceSnippets.slice(0, 6),
        ]),
        canonicalPath,
        status: GeneratedPageStatus.ready,
        lastGeneratedAt: new Date(),
      },
      create: {
        keywordId: keyword.id,
        slug,
        title: pageCopy.title,
        description: pageCopy.description,
        h1: keyword.text,
        summary: pageCopy.summary,
        faqRaw: JSON.stringify(pageCopy.bodyParagraphs),
        relatedKeywordsRaw: JSON.stringify([
          ...relatedKeywords.slice(0, 10),
          ...pageCopy.evidenceSnippets.slice(0, 6),
        ]),
        canonicalPath,
        status: GeneratedPageStatus.ready,
      },
    });

    await prisma.keyword.update({
      where: {
        id: keyword.id,
      },
      data: {
        status: KeywordStatus.analyzed,
      },
    });

    generatedCount += 1;
  }

  return {
    requestedCount: keywordIds.length,
    generatedCount,
  };
}

export async function generatePagesForSecondaryKeywords(secondaryKeywordIds: number[]) {
  const [keywords, dcBestDocs] = await Promise.all([
    prisma.keyword.findMany({
      where: {
        id: {
          in: secondaryKeywordIds,
        },
        level: KeywordLevel.secondary,
        status: {
          in: [KeywordStatus.analyzed, KeywordStatus.tracking],
        },
      },
      include: {
        parentKeyword: {
          include: {
            generatedPages: {
              where: {
                status: {
                  in: [GeneratedPageStatus.published, GeneratedPageStatus.ready],
                },
              },
              select: {
                slug: true,
                canonicalPath: true,
              },
              take: 1,
            },
          },
        },
        childKeywords: {
          where: {
            level: KeywordLevel.tertiary,
          },
          include: {
            metrics: {
              orderBy: {
                metricDate: "desc",
              },
              take: 1,
            },
          },
          take: 40,
        },
        metrics: {
          orderBy: {
            metricDate: "desc",
          },
          take: 1,
        },
      },
    }),
    getDcBestRawDocuments(),
  ]);

  if (keywords.length === 0) {
    return { requestedCount: secondaryKeywordIds.length, generatedCount: 0 };
  }

  let generatedCount = 0;

  for (const keyword of keywords) {
    const siblingKeywords = keyword.parentKeyword
      ? await prisma.keyword.findMany({
          where: {
            parentKeywordId: keyword.parentKeyword.id,
            level: KeywordLevel.secondary,
            id: { not: keyword.id },
            status: { in: [KeywordStatus.analyzed, KeywordStatus.tracking] },
          },
          select: { text: true },
          take: 12,
        })
      : [];
    const relatedTexts = [
      ...siblingKeywords.map((s) => s.text),
      ...keyword.childKeywords.map((c) => c.text),
    ];

    const parentText = keyword.parentKeyword?.text ?? keyword.text;
    const parentPagePath = keyword.parentKeyword?.generatedPages[0]?.canonicalPath ?? null;

    const sampledDocs = selectSupportingDocuments(dcBestDocs, keyword.text, relatedTexts);
    const parsedDocs = sampledDocs.map((document) => parseDcBestContentBlock(document.content));
    const emphasizedRelated = relatedTexts.slice(0, 6);

    const title = truncate(`${keyword.text} - ${parentText} 커뮤니티 반응 & 트렌드`, 60);
    const description = truncate(
      `${keyword.text} 관련 커뮤니티 실시간 인기글과 반응을 정리했습니다. ${parentText} 키워드의 세부 트렌드 페이지입니다. | 커뮤니티위키코리아`,
      155,
    );
    const summary = truncate(
      `${keyword.text}는 ${parentText}의 세부 트렌드 키워드입니다. 커뮤니티 실시간 반응과 관련 인기글을 정리했습니다.`,
      220,
    );
    const bodyParagraphs = [
      truncate(
        `${keyword.text} 키워드는 ${parentText}${parentPagePath ? " 허브" : ""} 주제 아래에서 커뮤니티에서 주목받고 있는 세부 트렌드입니다. ${emphasizedRelated.length > 0 ? `비슷한 맥락의 키워드로는 ${emphasizedRelated.join(", ")} 등이 있습니다.` : ""}`,
        320,
      ),
      ...parsedDocs.map((item, index) =>
        truncate(
          `${index + 1}. "${item.title || keyword.text}" — 작성일 ${item.date || "최근"}, 조회수 ${item.views || "확인 중"}, 추천 ${item.recommends || "확인 중"}.`,
          320,
        ),
      ),
      truncate(
        `${keyword.text} 외에도 ${emphasizedRelated.join(", ") || parentText} 등 관련 키워드의 실시간 커뮤니티 반응을 커뮤니티위키코리아에서 확인할 수 있습니다.`,
        320,
      ),
    ].filter(Boolean);

    const evidenceSnippets = parsedDocs.map((item) =>
      truncate(
        `${item.title || keyword.text} | ${item.author || "익명"} | ${item.date || "최근"} | 조회 ${item.views || "-"} | 추천 ${item.recommends || "-"}`,
        160,
      ),
    );

    const slug = await resolveGeneratedPageSlug(keyword.id, keyword.normalizedText);
    const canonicalPath = `/keywords/${slug}`;

    await prisma.generatedPage.upsert({
      where: {
        keywordId: keyword.id,
      },
      update: {
        slug,
        title,
        description,
        h1: keyword.text,
        summary,
        faqRaw: JSON.stringify(bodyParagraphs),
        relatedKeywordsRaw: JSON.stringify([
          ...relatedTexts.slice(0, 10),
          ...evidenceSnippets.slice(0, 6),
        ]),
        canonicalPath,
        status: GeneratedPageStatus.ready,
        lastGeneratedAt: new Date(),
      },
      create: {
        keywordId: keyword.id,
        slug,
        title,
        description,
        h1: keyword.text,
        summary,
        faqRaw: JSON.stringify(bodyParagraphs),
        relatedKeywordsRaw: JSON.stringify([
          ...relatedTexts.slice(0, 10),
          ...evidenceSnippets.slice(0, 6),
        ]),
        canonicalPath,
        status: GeneratedPageStatus.ready,
      },
    });

    generatedCount += 1;
  }

  return {
    requestedCount: secondaryKeywordIds.length,
    generatedCount,
  };
}

export async function getGeneratedPages(limit = 120) {
  return prisma.generatedPage.findMany({
    include: {
      hub: true,
      keyword: {
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
    orderBy: [{ lastGeneratedAt: "desc" }],
    take: limit,
  });
}

export async function getPublishedGeneratedPages(limit = 5000) {
  return prisma.generatedPage.findMany({
    where: {
      status: GeneratedPageStatus.published,
    },
    include: {
      hub: true,
      keyword: {
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
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  });
}

export async function getGeneratedPageBySlug(slug: string) {
  return prisma.generatedPage.findUnique({
    where: {
      slug,
    },
    include: {
      keyword: {
        include: {
          hub: true,
          parentKeyword: {
            include: {
              generatedPages: {
                where: {
                  status: GeneratedPageStatus.published,
                },
                select: {
                  slug: true,
                  canonicalPath: true,
                },
                take: 1,
              },
            },
          },
          analyses: {
            orderBy: {
              generatedAt: "desc",
            },
            take: 1,
          },
          childKeywords: {
            include: {
              generatedPages: {
                where: {
                  status: {
                    in: [GeneratedPageStatus.published, GeneratedPageStatus.ready],
                  },
                },
                orderBy: {
                  updatedAt: "desc",
                },
                take: 1,
              },
              metrics: {
                orderBy: {
                  metricDate: "desc",
                },
                take: 1,
              },
            },
            take: 16,
          },
          metrics: {
            orderBy: {
              metricDate: "desc",
            },
            take: 1,
          },
        },
      },
    },
  });
}

function uniqueSlugCandidates(slug: string) {
  const candidates = new Set<string>();
  const values = [slug];

  try {
    values.push(decodeURIComponent(slug));
  } catch {
    // Keep the original slug when decoding fails.
  }

  for (const value of values) {
    candidates.add(value);
    candidates.add(value.normalize("NFC"));
    candidates.add(value.normalize("NFD"));
  }

  return [...candidates].filter(Boolean);
}

export async function getGeneratedPageByRouteSlug(slug: string) {
  for (const candidate of uniqueSlugCandidates(slug)) {
    const page = await getGeneratedPageBySlug(candidate);

    if (page) {
      return page;
    }
  }

  return null;
}

export function parseGeneratedPageArray(value?: string | null) {
  return parseStringArray(value);
}
