import { GeneratedPageStatus, KeywordLevel, KeywordStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function slugifyKeyword(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
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

export async function generatePagesForKeywords(keywordIds: number[]) {
  const keywords = await prisma.keyword.findMany({
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
        take: 12,
      },
      metrics: {
        orderBy: {
          metricDate: "desc",
        },
        take: 1,
      },
      hub: {
        include: {
          representativeKeyword: {
            include: {
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
                take: 12,
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
      },
    },
  });

  if (keywords.length === 0) {
    throw new Error("No eligible analyzed secondary keywords found for page generation");
  }

  let generatedCount = 0;

  for (const keyword of keywords) {
    const representativeKeyword = keyword.hub?.representativeKeyword ?? keyword;
    const latestAnalysis = representativeKeyword.analyses[0];

    if (!latestAnalysis) {
      continue;
    }

    const relatedKeywords = [
      ...parseStringArray(latestAnalysis.relatedKeywordsRaw),
      ...representativeKeyword.childKeywords.map((child) => child.text),
    ].filter((value, index, array) => array.indexOf(value) === index);
    const faq = parseStringArray(latestAnalysis.faqRaw);
    const title = latestAnalysis.snippetTitle || `${representativeKeyword.text} 관련 정보`;
    const description =
      latestAnalysis.snippetDescription || latestAnalysis.summary || `${keyword.text} 요약 정보`;
    const summary = latestAnalysis.summary || latestAnalysis.snippetDescription || "";
    const slug = slugifyKeyword(keyword.hub?.normalizedName ?? representativeKeyword.normalizedText);
    const canonicalPath = `/keywords/${slug}`;
    const status =
      representativeKeyword.status === KeywordStatus.analyzed
        ? GeneratedPageStatus.ready
        : GeneratedPageStatus.draft;
    const pageWhere = keyword.hubId
      ? { hubId: keyword.hubId }
      : { keywordId: representativeKeyword.id };

    const existingByHub = keyword.hubId
      ? await prisma.generatedPage.findUnique({
          where: {
            hubId: keyword.hubId,
          },
        })
      : null;

    if (existingByHub) {
      await prisma.generatedPage.update({
        where: {
          id: existingByHub.id,
        },
        data: {
          keywordId: representativeKeyword.id,
          slug,
          title,
          description,
          h1: keyword.hub?.name ?? representativeKeyword.text,
          summary,
          faqRaw: JSON.stringify(faq),
          relatedKeywordsRaw: JSON.stringify(relatedKeywords),
          canonicalPath,
          status,
          lastGeneratedAt: new Date(),
        },
      });
    } else {
      await prisma.generatedPage.upsert({
        where: pageWhere,
        update: {
          hubId: keyword.hubId,
          keywordId: representativeKeyword.id,
          slug,
          title,
          description,
          h1: keyword.hub?.name ?? representativeKeyword.text,
          summary,
          faqRaw: JSON.stringify(faq),
          relatedKeywordsRaw: JSON.stringify(relatedKeywords),
          canonicalPath,
          status,
          lastGeneratedAt: new Date(),
        },
        create: {
          hubId: keyword.hubId,
          keywordId: representativeKeyword.id,
          slug,
          title,
          description,
          h1: keyword.hub?.name ?? representativeKeyword.text,
          summary,
          faqRaw: JSON.stringify(faq),
          relatedKeywordsRaw: JSON.stringify(relatedKeywords),
          canonicalPath,
          status,
        },
      });
    }

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
      keyword: true,
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
