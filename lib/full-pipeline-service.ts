import { KeywordLevel, KeywordStatus } from "@prisma/client";

import { generatePagesForKeywords } from "@/lib/generated-page-service";
import { clusterSecondaryKeywords } from "@/lib/hub-service";
import { ingestSource } from "@/lib/ingestion-service";
import { generateKeywordAnalysesForKeywords } from "@/lib/keyword-analysis-service";
import { generatePrimaryKeywordsForSources } from "@/lib/keyword-service";
import {
  completePipelineRun,
  createInitialPipelineSteps,
  createPipelineRun,
  failPipelineRun,
  type PipelineStep,
  updatePipelineRunSteps,
} from "@/lib/pipeline-run";
import { prisma } from "@/lib/prisma";
import { publishGeneratedPage, publishHub } from "@/lib/publish-service";
import { generateSecondaryKeywordsForPrimaryKeywords } from "@/lib/secondary-keyword-service";

const DEFAULT_SOURCE_IDS = ["dcinside", "fmkorea", "mlbpark", "dogdrip"] as const;

type FullPipelineOptions = {
  sourceIds?: string[];
  maxPrimaryKeywords?: number;
  maxSecondaryAnalyses?: number;
  limitPerPrimary?: number;
  publishEligible?: boolean;
};

type IngestionSuccess = {
  ok: true;
  sourceId: string;
  fetchedCount: number;
  storedCount: number;
  method: string;
};

type IngestionFailure = {
  ok: false;
  sourceId: string;
  error: string;
};

type StageUpdate = {
  stepId: PipelineStep["id"];
  status: PipelineStep["status"];
  summary?: string;
};

type FullPipelineHooks = {
  onStageUpdate?: (update: StageUpdate) => Promise<void> | void;
};

function getOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function compareKeywordPriority(
  left: {
    pinned: boolean;
    pinnedAt: Date | null;
    lastSeenAt: Date;
    metrics: Array<{ opportunityScore: number }>;
  },
  right: {
    pinned: boolean;
    pinnedAt: Date | null;
    lastSeenAt: Date;
    metrics: Array<{ opportunityScore: number }>;
  },
) {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  const leftOpportunity = left.metrics[0]?.opportunityScore ?? 0;
  const rightOpportunity = right.metrics[0]?.opportunityScore ?? 0;

  if (rightOpportunity !== leftOpportunity) {
    return rightOpportunity - leftOpportunity;
  }

  const leftPinnedAt = left.pinnedAt?.getTime() ?? 0;
  const rightPinnedAt = right.pinnedAt?.getTime() ?? 0;

  if (rightPinnedAt !== leftPinnedAt) {
    return rightPinnedAt - leftPinnedAt;
  }

  return right.lastSeenAt.getTime() - left.lastSeenAt.getTime();
}

export async function runFullPipeline(
  options: FullPipelineOptions = {},
  hooks: FullPipelineHooks = {},
) {
  const sourceIds = options.sourceIds?.length ? options.sourceIds : [...DEFAULT_SOURCE_IDS];
  const maxPrimaryKeywords = options.maxPrimaryKeywords ?? 8;
  const maxSecondaryAnalyses = options.maxSecondaryAnalyses ?? 24;
  const limitPerPrimary = options.limitPerPrimary ?? 10;
  const publishEligible = options.publishEligible ?? true;
  const notify = async (update: StageUpdate) => {
    await hooks.onStageUpdate?.(update);
  };

  const ingestion: Array<IngestionSuccess | IngestionFailure> = [];
  await notify({
    stepId: "ingest",
    status: "running",
  });

  for (const sourceId of sourceIds) {
    try {
      const result = await ingestSource(sourceId);
      ingestion.push({
        ok: true,
        sourceId,
        fetchedCount: result.fetchedCount,
        storedCount: result.storedCount,
        method: result.method,
      });
    } catch (error) {
      ingestion.push({
        ok: false,
        sourceId,
        error: error instanceof Error ? error.message : "Unknown ingestion error",
      });
    }
  }

  const successfulSourceIds = ingestion
    .filter((entry): entry is IngestionSuccess => entry.ok)
    .map((entry) => entry.sourceId);

  if (successfulSourceIds.length === 0) {
    throw new Error("Full pipeline aborted: no source ingestion succeeded");
  }

  await notify({
    stepId: "ingest",
    status: "completed",
    summary: `${successfulSourceIds.length}/${ingestion.length} sources ingested`,
  });

  await notify({
    stepId: "primary",
    status: "running",
  });
  const primaryResult = await generatePrimaryKeywordsForSources(successfulSourceIds);
  const primaryKeywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.primary,
      status: {
        in: [KeywordStatus.tracking, KeywordStatus.analyzed],
      },
      normalizedText: {
        in: primaryResult.keywords.map((keyword) => keyword.normalizedText),
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
  });

  const selectedPrimaryKeywords = primaryKeywords
    .sort(compareKeywordPriority)
    .slice(0, maxPrimaryKeywords);
  const selectedPrimaryKeywordIds = selectedPrimaryKeywords.map((keyword) => keyword.id);

  if (selectedPrimaryKeywordIds.length === 0) {
    throw new Error("Full pipeline aborted: no eligible primary keywords found");
  }

  await notify({
    stepId: "primary",
    status: "completed",
    summary: `${selectedPrimaryKeywordIds.length} primary keywords selected`,
  });

  await notify({
    stepId: "secondary",
    status: "running",
  });
  const secondaryResult = await generateSecondaryKeywordsForPrimaryKeywords(
    selectedPrimaryKeywordIds,
    limitPerPrimary,
  );
  const secondaryKeywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.secondary,
      parentKeywordId: {
        in: selectedPrimaryKeywordIds,
      },
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
      analyses: {
        orderBy: {
          generatedAt: "desc",
        },
        take: 1,
      },
    },
  });

  const selectedSecondaryKeywords = secondaryKeywords
    .sort(compareKeywordPriority)
    .slice(0, maxSecondaryAnalyses);
  const selectedSecondaryKeywordIds = selectedSecondaryKeywords.map((keyword) => keyword.id);

  await notify({
    stepId: "secondary",
    status: "completed",
    summary: `${selectedSecondaryKeywordIds.length} secondary keywords selected`,
  });

  let analysisResult:
    | {
        analyzedCount: number;
        tertiaryKeywordCount: number;
      }
    | {
        skipped: true;
        reason: string;
      };

  await notify({
    stepId: "analysis",
    status: "running",
  });

  if (!getOpenAIConfigured()) {
    analysisResult = {
      skipped: true,
      reason: "OPENAI_API_KEY is not configured",
    };
  } else if (selectedSecondaryKeywordIds.length === 0) {
    analysisResult = {
      skipped: true,
      reason: "No eligible secondary keywords found",
    };
  } else {
    analysisResult = await generateKeywordAnalysesForKeywords(selectedSecondaryKeywordIds);
  }

  await notify({
    stepId: "analysis",
    status: "skipped" in analysisResult ? "skipped" : "completed",
    summary:
      "skipped" in analysisResult
        ? analysisResult.reason
        : `${analysisResult.analyzedCount} keywords analyzed`,
  });

  const analyzedSecondaryKeywords = await prisma.keyword.findMany({
    where: {
      id: {
        in: selectedSecondaryKeywordIds,
      },
      level: KeywordLevel.secondary,
      status: KeywordStatus.analyzed,
      analyses: {
        some: {},
      },
    },
    select: {
      id: true,
      hubId: true,
    },
  });
  const analyzedSecondaryIds = analyzedSecondaryKeywords.map((keyword) => keyword.id);

  await notify({
    stepId: "hubs",
    status: "running",
  });
  const hubResult =
    analyzedSecondaryIds.length > 0
      ? await clusterSecondaryKeywords(analyzedSecondaryIds)
      : { hubCount: 0, mappedKeywordCount: 0 };

  await notify({
    stepId: "hubs",
    status: "completed",
    summary: `${hubResult.hubCount} hubs materialized`,
  });

  await notify({
    stepId: "pages",
    status: "running",
  });
  const pageResult =
    analyzedSecondaryIds.length > 0
      ? await generatePagesForKeywords(analyzedSecondaryIds)
      : { requestedCount: 0, generatedCount: 0 };

  await notify({
    stepId: "pages",
    status: "completed",
    summary: `${pageResult.generatedCount} pages generated`,
  });

  const publishResults = [];
  await notify({
    stepId: "publish",
    status: "running",
  });

  if (publishEligible && analyzedSecondaryIds.length > 0) {
    const generatedPages = await prisma.generatedPage.findMany({
      where: {
        keywordId: {
          in: analyzedSecondaryIds,
        },
      },
      select: {
        id: true,
        hubId: true,
      },
    });

    const publishedHubIds = new Set<number>();

    for (const page of generatedPages) {
      try {
        if (page.hubId) {
          if (publishedHubIds.has(page.hubId)) {
            continue;
          }

          await publishHub(page.hubId);
          publishedHubIds.add(page.hubId);
          publishResults.push({
            ok: true,
            type: "hub",
            targetId: page.hubId,
          });
        } else {
          await publishGeneratedPage(page.id);
          publishResults.push({
            ok: true,
            type: "page",
            targetId: page.id,
          });
        }
      } catch (error) {
        publishResults.push({
          ok: false,
          type: page.hubId ? "hub" : "page",
          targetId: page.hubId ?? page.id,
          error: error instanceof Error ? error.message : "Unknown publish error",
        });
      }
    }
  }

  await notify({
    stepId: "publish",
    status: publishResults.some((entry) => !entry.ok) ? "failed" : "completed",
    summary: `${publishResults.filter((entry) => entry.ok).length} published, ${publishResults.filter((entry) => !entry.ok).length} failed`,
  });

  return {
    sourceIds,
    ingestion,
    primary: {
      ...primaryResult,
      selectedKeywordIds: selectedPrimaryKeywordIds,
      selectedKeywordTexts: selectedPrimaryKeywords.map((keyword) => keyword.text),
    },
    secondary: {
      ...secondaryResult,
      selectedKeywordIds: selectedSecondaryKeywordIds,
      selectedKeywordTexts: selectedSecondaryKeywords.map((keyword) => keyword.text),
    },
    analysis: analysisResult,
    hubs: hubResult,
    pages: pageResult,
    publish: {
      attempted: publishResults.length,
      succeeded: publishResults.filter((entry) => entry.ok).length,
      failed: publishResults.filter((entry) => !entry.ok).length,
      results: publishResults,
    },
  };
}

export async function runTrackedFullPipeline(options: FullPipelineOptions = {}) {
  const sourceIds = options.sourceIds?.length ? options.sourceIds : [...DEFAULT_SOURCE_IDS];
  const run = await createPipelineRun(sourceIds);
  const steps = createInitialPipelineSteps();

  async function syncSteps() {
    await updatePipelineRunSteps(run.id, steps);
  }

  function updateStep(
    stepId: PipelineStep["id"],
    patch: Partial<PipelineStep>,
  ) {
    const target = steps.find((step) => step.id === stepId);

    if (!target) {
      return;
    }

    Object.assign(target, patch);
  }

  try {
    const result = await runFullPipeline(options, {
      onStageUpdate: async (update) => {
        const now = new Date().toISOString();
        const current = steps.find((step) => step.id === update.stepId);

        updateStep(update.stepId, {
          status: update.status,
          summary: update.summary,
          startedAt:
            update.status === "running"
              ? current?.startedAt ?? now
              : current?.startedAt,
          finishedAt:
            update.status === "completed" ||
            update.status === "failed" ||
            update.status === "skipped"
              ? now
              : undefined,
        });
        await syncSteps();
      },
    });

    await completePipelineRun(run.id, steps, {
      ingestedSources: result.ingestion.filter((entry) => entry.ok).length,
      selectedPrimaryKeywords: result.primary.selectedKeywordIds.length,
      selectedSecondaryKeywords: result.secondary.selectedKeywordIds.length,
      analyzedKeywords: "skipped" in result.analysis ? 0 : result.analysis.analyzedCount,
      generatedPages: result.pages.generatedCount,
      publishedItems: result.publish.succeeded,
    });

    return {
      runId: run.id,
      ...result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline error";
    const runningStep =
      steps.find((step) => step.status === "running") ??
      steps.find((step) => step.status === "pending");

    if (runningStep) {
      updateStep(runningStep.id, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: message,
      });
    }

    await syncSteps();
    await failPipelineRun(run.id, steps, message);
    throw error;
  }
}
