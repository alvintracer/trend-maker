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
    .replace(/-+/g, "-");
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
  parentKeywordText?: string | null,
) {
  const tokens = new Set([
    ...tokenizeKeyword(keywordText),
    ...tokenizeKeyword(parentKeywordText ?? ""),
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
  parentKeywordText?: string | null;
  docs: Array<{ title: string | null; content: string; url: string }>;
  relatedKeywords: string[];
}) {
  const sampledDocs = selectSupportingDocuments(
    input.docs,
    input.keywordText,
    input.parentKeywordText,
  );
  const parsedDocs = sampledDocs.map((document) => parseDcBestContentBlock(document.content));
  const fallbackRows = parsedDocs.map((item) => item.row).filter(Boolean);

  const summary = truncate(
    `${input.keywordText} 관련 흐름을 디시 실시간베스트 최근 5페이지 기준으로 정리했습니다. 최근 노출 글의 제목, 반응 수치, 작성 시점을 조합해 지금 어떤 맥락에서 ${input.keywordText}가 붙는지 빠르게 읽을 수 있게 구성했습니다.`,
    220,
  );
  const title = truncate(`${input.keywordText} 디시 실시간베스트 반응 정리`, 60);
  const description = truncate(
    `${input.keywordText} 관련 디시 실시간베스트 최근 반응, 제목 흐름, 조회·추천 포인트를 묶어 정리한 페이지입니다.`,
    110,
  );
  const bodyParagraphs = [
    truncate(
      `${input.keywordText}는 최근 디시 실시간베스트에서 단독 키워드라기보다 다른 사건, 후기, 이슈 문장 안에서 반복 결합되는 형태로 보입니다. 상단 노출 글들을 기준으로 보면 제목 조합과 반응 수치가 빠르게 바뀌기 때문에 ${input.keywordText}를 포함한 문장 묶음을 함께 읽는 편이 흐름 파악에 유리합니다.`,
      320,
    ),
    ...parsedDocs.map((item, index) =>
      truncate(
        `${index + 1}번째 참고 글은 "${item.title || fallbackRows[index] || input.keywordText}" 형태였고 작성 시점은 ${
          item.date || "최근"
        }, 조회 ${item.views || "확인 중"}, 추천 ${item.recommends || "확인 중"} 수준이었습니다. 이 조합은 ${input.keywordText}가 어떤 문장 패턴과 같이 소비되는지 보여주는 실시간 샘플로 볼 수 있습니다.`,
        320,
      ),
    ),
    truncate(
      `${input.keywordText}와 함께 자주 붙는 표현으로는 ${input.relatedKeywords.slice(0, 6).join(", ") || input.parentKeywordText || input.keywordText} 등이 있습니다. 따라서 본문과 메타데이터는 단일 정의형 문장보다 최근 노출 패턴과 반응 맥락을 함께 읽을 수 있도록 구성했습니다.`,
      320,
    ),
  ].filter(Boolean);

  const evidenceSnippets = parsedDocs.map((item) =>
    truncate(
      `${item.title || input.keywordText} | 작성자 ${item.author || "익명"} | ${item.date || "최근"} | 조회 ${item.views || "-"} | 추천 ${item.recommends || "-"}`,
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
        level: KeywordLevel.secondary,
        status: {
          in: [KeywordStatus.analyzed, KeywordStatus.tracking],
        },
      },
      include: {
        parentKeyword: true,
        suggestedBy: {
          include: {
            parentKeyword: true,
          },
          orderBy: {
            rank: "asc",
          },
          take: 16,
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
          take: 12,
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
    throw new Error("No eligible secondary keywords found for page generation");
  }

  if (dcBestDocs.length === 0) {
    throw new Error("No DCBest raw documents available for page composition");
  }

  let generatedCount = 0;

  for (const keyword of keywords) {
    const relatedKeywords = [
      ...keyword.suggestedBy.map((entry) => entry.parentKeyword.text),
      ...keyword.childKeywords.map((child) => child.text),
    ].filter((value, index, array) => array.indexOf(value) === index);
    const pageCopy = buildPageCopy({
      keywordText: keyword.text,
      parentKeywordText: keyword.parentKeyword?.text,
      docs: dcBestDocs,
      relatedKeywords,
    });
    const slug = slugifyKeyword(keyword.normalizedText);
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
          analyses: {
            orderBy: {
              generatedAt: "desc",
            },
            take: 1,
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

export function parseGeneratedPageArray(value?: string | null) {
  return parseStringArray(value);
}
