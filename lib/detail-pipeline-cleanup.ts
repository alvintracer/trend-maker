import { KeywordLevel } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DetailPipelineCleanupResult = {
  stalePrimaryCount: number;
  detachedSuggestRelationCount: number;
  deletedGeneratedPageCount: number;
  deletedSecondaryCount: number;
  deletedTertiaryCount: number;
  deletedAnalysisCount: number;
  deletedMetricCount: number;
  trimmedAnalysisCount: number;
  trimmedMetricCount: number;
};

async function deleteOlderKeywordAnalyses(keywordIds: number[]) {
  if (keywordIds.length === 0) {
    return 0;
  }

  const rows = await prisma.keywordAnalysis.findMany({
    where: {
      keywordId: {
        in: keywordIds,
      },
    },
    orderBy: [{ keywordId: "asc" }, { generatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      keywordId: true,
    },
  });

  const keepByKeyword = new Set<number>();
  const deleteIds: number[] = [];

  for (const row of rows) {
    if (!keepByKeyword.has(row.keywordId)) {
      keepByKeyword.add(row.keywordId);
      continue;
    }

    deleteIds.push(row.id);
  }

  if (deleteIds.length === 0) {
    return 0;
  }

  const result = await prisma.keywordAnalysis.deleteMany({
    where: {
      id: {
        in: deleteIds,
      },
    },
  });

  return result.count;
}

async function deleteOlderKeywordMetrics(keywordIds: number[]) {
  if (keywordIds.length === 0) {
    return 0;
  }

  const rows = await prisma.keywordMetric.findMany({
    where: {
      keywordId: {
        in: keywordIds,
      },
    },
    orderBy: [{ keywordId: "asc" }, { metricDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      keywordId: true,
    },
  });

  const keepByKeyword = new Set<number>();
  const deleteIds: number[] = [];

  for (const row of rows) {
    if (!keepByKeyword.has(row.keywordId)) {
      keepByKeyword.add(row.keywordId);
      continue;
    }

    deleteIds.push(row.id);
  }

  if (deleteIds.length === 0) {
    return 0;
  }

  const result = await prisma.keywordMetric.deleteMany({
    where: {
      id: {
        in: deleteIds,
      },
    },
  });

  return result.count;
}

export async function cleanupDetailPipelineData(input: {
  retainedPrimaryKeywordIds: number[];
  retainedSecondaryKeywordIds: number[];
}) {
  const retainedPrimaryKeywordIds = [...new Set(input.retainedPrimaryKeywordIds)];
  const retainedSecondaryKeywordIds = [...new Set(input.retainedSecondaryKeywordIds)];

  const stalePrimaryKeywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.primary,
      isManual: true,
      sourceLabel: {
        not: "namu_wiki",
      },
      ...(retainedPrimaryKeywordIds.length > 0
        ? {
            id: {
              notIn: retainedPrimaryKeywordIds,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });
  const stalePrimaryKeywordIds = stalePrimaryKeywords.map((keyword) => keyword.id);

  const generatedPageDeleteResult =
    stalePrimaryKeywordIds.length > 0
      ? await prisma.generatedPage.deleteMany({
          where: {
            keywordId: {
              in: stalePrimaryKeywordIds,
            },
          },
        })
      : { count: 0 };

  const staleRelations =
    stalePrimaryKeywordIds.length > 0
      ? await prisma.keywordSuggestResult.findMany({
          where: {
            parentKeywordId: {
              in: stalePrimaryKeywordIds,
            },
          },
          select: {
            suggestedKeywordId: true,
          },
        })
      : [];
  const affectedSecondaryKeywordIds = [...new Set(staleRelations.map((row) => row.suggestedKeywordId))];

  const detachedRelationsResult =
    stalePrimaryKeywordIds.length > 0
      ? await prisma.keywordSuggestResult.deleteMany({
          where: {
            parentKeywordId: {
              in: stalePrimaryKeywordIds,
            },
          },
        })
      : { count: 0 };

  const orphanSecondaryCandidates =
    affectedSecondaryKeywordIds.length > 0
      ? await prisma.keyword.findMany({
          where: {
            id: {
              in: affectedSecondaryKeywordIds,
            },
            level: KeywordLevel.secondary,
            ...(retainedSecondaryKeywordIds.length > 0
              ? {
                  id: {
                    in: affectedSecondaryKeywordIds.filter(
                      (keywordId) => !retainedSecondaryKeywordIds.includes(keywordId),
                    ),
                  },
                }
              : {}),
          },
          select: {
            id: true,
            sourceLabel: true,
            _count: {
              select: {
                suggestedBy: true,
              },
            },
          },
        })
      : [];

  const orphanSecondaryKeywordIds = orphanSecondaryCandidates
    .filter((keyword) => keyword.sourceLabel !== "namu_wiki_actor")
    .filter((keyword) => keyword._count.suggestedBy === 0)
    .map((keyword) => keyword.id);

  const orphanTertiaryKeywords =
    orphanSecondaryKeywordIds.length > 0
      ? await prisma.keyword.findMany({
          where: {
            level: KeywordLevel.tertiary,
            parentKeywordId: {
              in: orphanSecondaryKeywordIds,
            },
          },
          select: {
            id: true,
          },
        })
      : [];
  const orphanTertiaryKeywordIds = orphanTertiaryKeywords.map((keyword) => keyword.id);

  const tertiaryMetricDeleteResult =
    orphanTertiaryKeywordIds.length > 0
      ? await prisma.keywordMetric.deleteMany({
          where: {
            keywordId: {
              in: orphanTertiaryKeywordIds,
            },
          },
        })
      : { count: 0 };

  if (orphanTertiaryKeywordIds.length > 0) {
    await prisma.generatedPage.deleteMany({
      where: {
        keywordId: {
          in: orphanTertiaryKeywordIds,
        },
      },
    });
  }

  const tertiaryKeywordDeleteResult =
    orphanTertiaryKeywordIds.length > 0
      ? await prisma.keyword.deleteMany({
          where: {
            id: {
              in: orphanTertiaryKeywordIds,
            },
          },
        })
      : { count: 0 };

  const orphanAnalysisDeleteResult =
    orphanSecondaryKeywordIds.length > 0
      ? await prisma.keywordAnalysis.deleteMany({
          where: {
            keywordId: {
              in: orphanSecondaryKeywordIds,
            },
          },
        })
      : { count: 0 };

  const orphanMetricDeleteResult =
    orphanSecondaryKeywordIds.length > 0
      ? await prisma.keywordMetric.deleteMany({
          where: {
            keywordId: {
              in: orphanSecondaryKeywordIds,
            },
          },
        })
      : { count: 0 };

  if (orphanSecondaryKeywordIds.length > 0) {
    await prisma.generatedPage.deleteMany({
      where: {
        keywordId: {
          in: orphanSecondaryKeywordIds,
        },
      },
    });
  }

  const orphanSecondaryDeleteResult =
    orphanSecondaryKeywordIds.length > 0
      ? await prisma.keyword.deleteMany({
          where: {
            id: {
              in: orphanSecondaryKeywordIds,
            },
          },
        })
      : { count: 0 };

  const retainedTertiaryKeywords =
    retainedSecondaryKeywordIds.length > 0
      ? await prisma.keyword.findMany({
          where: {
            level: KeywordLevel.tertiary,
            parentKeywordId: {
              in: retainedSecondaryKeywordIds,
            },
          },
          select: {
            id: true,
          },
        })
      : [];
  const retainedTertiaryKeywordIds = retainedTertiaryKeywords.map((keyword) => keyword.id);

  const trimmedAnalysisCount = await deleteOlderKeywordAnalyses(retainedSecondaryKeywordIds);
  const trimmedMetricCount = await deleteOlderKeywordMetrics([
    ...retainedPrimaryKeywordIds,
    ...retainedSecondaryKeywordIds,
    ...retainedTertiaryKeywordIds,
  ]);

  const deletedMetricCount = tertiaryMetricDeleteResult.count + orphanMetricDeleteResult.count;

  return {
    stalePrimaryCount: stalePrimaryKeywordIds.length,
    detachedSuggestRelationCount: detachedRelationsResult.count,
    deletedGeneratedPageCount: generatedPageDeleteResult.count,
    deletedSecondaryCount: orphanSecondaryDeleteResult.count,
    deletedTertiaryCount: tertiaryKeywordDeleteResult.count,
    deletedAnalysisCount: orphanAnalysisDeleteResult.count,
    deletedMetricCount,
    trimmedAnalysisCount,
    trimmedMetricCount,
  } satisfies DetailPipelineCleanupResult;
}
