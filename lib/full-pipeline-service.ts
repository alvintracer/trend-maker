import { GeneratedPageStatus, KeywordLevel, KeywordStatus } from "@prisma/client";

import { generatePagesForKeywords } from "@/lib/generated-page-service";
import { ingestSource } from "@/lib/ingestion-service";
import { cleanupDetailPipelineData } from "@/lib/detail-pipeline-cleanup";
import { generateKeywordAnalysesForKeywords } from "@/lib/keyword-analysis-service";
import { generatePrimaryKeywordsForSources } from "@/lib/keyword-service";
import { getManualPrimaryKeywords } from "@/lib/keyword-repository";
import {
  appendPipelineRunLog,
  cancelCompletedPipelineRun,
  completePipelineRun,
  createInitialPipelineSteps,
  createPipelineRun,
  failPipelineRun,
  getPipelineRunRuntime,
  type PipelineStep,
  updatePipelineRunSteps,
} from "@/lib/pipeline-run";
import { prisma } from "@/lib/prisma";
import { publishGeneratedPage } from "@/lib/publish-service";
import { generateSecondaryKeywordsForPrimaryKeywords } from "@/lib/secondary-keyword-service";

const DEFAULT_SOURCE_IDS = ["dcinside", "fmkorea", "mlbpark", "dogdrip"] as const;
const STAGE_ORDER: PipelineStep["id"][] = [
  "ingest",
  "primary",
  "secondary",
  "analysis",
  "pages",
  "publish",
];

type PrimarySelectionMode = "auto" | "manual";
type StageDisposition = "before" | "run" | "after";

type FullPipelineOptions = {
  sourceIds?: string[];
  maxPrimaryKeywords?: number;
  maxSecondaryAnalyses?: number;
  limitPerPrimary?: number;
  publishEligible?: boolean;
  startFrom?: PipelineStep["id"];
  endAt?: PipelineStep["id"];
  skipIngest?: boolean;
  primarySelection?: PrimarySelectionMode;
  secondaryForceRefresh?: boolean;
  skipAnalysis?: boolean;
  cleanupStaleDetailData?: boolean;
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
  assertContinuable?: () => Promise<void> | void;
};

type KeywordWithMetrics = {
  id: number;
  text: string;
  normalizedText?: string;
  pinned: boolean;
  pinnedAt: Date | null;
  lastSeenAt: Date;
  metrics: Array<{ opportunityScore: number }>;
};

function getOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function compareKeywordPriority(left: KeywordWithMetrics, right: KeywordWithMetrics) {
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

async function getReusablePrimaryKeywords(limit: number) {
  const keywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.primary,
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
    take: 200,
  });

  return keywords.sort(compareKeywordPriority).slice(0, limit);
}

async function getReusableSecondaryKeywords(primaryKeywordIds: number[], limit: number) {
  const keywords = await prisma.keyword.findMany({
    where: {
      level: KeywordLevel.secondary,
      parentKeywordId: {
        in: primaryKeywordIds,
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
    take: 300,
  });

  return keywords.sort(compareKeywordPriority).slice(0, limit);
}

function createStageDispositionResolver(startFrom: PipelineStep["id"], endAt: PipelineStep["id"]) {
  const startIndex = Math.max(0, STAGE_ORDER.indexOf(startFrom));
  const endIndex = Math.max(startIndex, STAGE_ORDER.indexOf(endAt));

  return {
    startIndex,
    endIndex,
    resolve(stepId: PipelineStep["id"]): StageDisposition {
      const index = STAGE_ORDER.indexOf(stepId);

      if (index < startIndex) {
        return "before";
      }

      if (index > endIndex) {
        return "after";
      }

      return "run";
    },
  };
}

export async function runFullPipeline(
  options: FullPipelineOptions = {},
  hooks: FullPipelineHooks = {},
) {
  const skipIngest = options.skipIngest ?? false;
  const sourceIds = skipIngest
    ? []
    : options.sourceIds?.length
      ? options.sourceIds
      : [...DEFAULT_SOURCE_IDS];
  const maxPrimaryKeywords = options.maxPrimaryKeywords ?? 30;
  const maxSecondaryAnalyses = options.maxSecondaryAnalyses ?? 24;
  const limitPerPrimary = options.limitPerPrimary ?? 10;
  const publishEligible = options.publishEligible ?? true;
  const startFrom = options.startFrom ?? "ingest";
  const endAt = options.endAt ?? "publish";
  const primarySelection = options.primarySelection ?? "auto";
  const secondaryForceRefresh = options.secondaryForceRefresh ?? false;
  const skipAnalysis = options.skipAnalysis ?? false;
  const cleanupStaleDetailData = options.cleanupStaleDetailData ?? false;
  const stageResolver = createStageDispositionResolver(startFrom, endAt);
  const notify = async (update: StageUpdate) => {
    await hooks.onStageUpdate?.(update);
  };
  const assertContinuable = async () => {
    await hooks.assertContinuable?.();
  };

  const ingestion: Array<IngestionSuccess | IngestionFailure> = [];
  let successfulSourceIds = [...sourceIds];
  let selectedPrimaryKeywords: KeywordWithMetrics[] = [];
  let selectedPrimaryKeywordIds: number[] = [];
  let selectedSecondaryKeywords: Array<
    KeywordWithMetrics & { analyses: Array<{ generatedAt: Date }> }
  > = [];
  let selectedSecondaryKeywordIds: number[] = [];

  let primaryResult:
    | Awaited<ReturnType<typeof generatePrimaryKeywordsForSources>>
    | {
        sourceIds: string[];
        sourceCount: number;
        documentCount: number;
        keywordCount: number;
        keywords: Array<{ normalizedText: string }>;
      };

  let secondaryResult:
    | Awaited<ReturnType<typeof generateSecondaryKeywordsForPrimaryKeywords>>
    | {
        parentKeywordCount: number;
        secondaryKeywordCount: number;
        acceptedSecondaryKeywordCount: number;
        blockedSecondaryKeywordCount: number;
        cachedParentKeywordCount: number;
        fetchedParentKeywordCount: number;
        failedQueryCount: number;
      };

  let analysisResult:
    | {
        analyzedCount: number;
        tertiaryKeywordCount: number;
      }
    | {
        skipped: true;
        reason: string;
      };

  const ingestDisposition = stageResolver.resolve("ingest");
  if (ingestDisposition === "run" && !skipIngest) {
    await assertContinuable();
    await notify({ stepId: "ingest", status: "running" });

    for (const sourceId of sourceIds) {
      await assertContinuable();
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

    successfulSourceIds = ingestion
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
  } else {
    await notify({
      stepId: "ingest",
      status: "skipped",
      summary:
        ingestDisposition === "before"
          ? "Skipped ingestion and reused existing raw documents"
          : skipIngest
            ? "Manual expansion mode: source ingestion disabled"
            : `Pipeline target reached after ${endAt}`,
    });
  }

  const primaryDisposition = stageResolver.resolve("primary");
  if (primaryDisposition === "run") {
    await assertContinuable();
    await notify({ stepId: "primary", status: "running" });

    if (primarySelection === "manual") {
      selectedPrimaryKeywords = await getManualPrimaryKeywords(maxPrimaryKeywords);
      primaryResult = {
        sourceIds: [],
        sourceCount: 0,
        documentCount: 0,
        keywordCount: selectedPrimaryKeywords.length,
        keywords: selectedPrimaryKeywords.map((keyword) => ({
          normalizedText: keyword.normalizedText ?? keyword.text,
        })),
      };
    } else {
      primaryResult = await generatePrimaryKeywordsForSources(successfulSourceIds);
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

      selectedPrimaryKeywords = primaryKeywords
        .sort(compareKeywordPriority)
        .slice(0, maxPrimaryKeywords);
    }

    selectedPrimaryKeywordIds = selectedPrimaryKeywords.map((keyword) => keyword.id);

    if (selectedPrimaryKeywordIds.length === 0) {
      throw new Error(
        primarySelection === "manual"
          ? "Manual expansion aborted: no manual primary keywords found"
          : "Full pipeline aborted: no eligible primary keywords found",
      );
    }

    await notify({
      stepId: "primary",
      status: "completed",
      summary:
        primarySelection === "manual"
          ? `${selectedPrimaryKeywordIds.length} manual primary keywords selected`
          : `${selectedPrimaryKeywordIds.length} primary keywords selected`,
    });
  } else if (primaryDisposition === "before") {
    selectedPrimaryKeywords =
      primarySelection === "manual"
        ? await getManualPrimaryKeywords(maxPrimaryKeywords)
        : await getReusablePrimaryKeywords(maxPrimaryKeywords);
    selectedPrimaryKeywordIds = selectedPrimaryKeywords.map((keyword) => keyword.id);

    if (selectedPrimaryKeywordIds.length === 0) {
      throw new Error(
        primarySelection === "manual"
          ? "No manual primary keywords found to continue the pipeline"
          : "No reusable primary keywords found to resume the pipeline",
      );
    }

    primaryResult = {
      sourceIds: successfulSourceIds,
      sourceCount: successfulSourceIds.length,
      documentCount: 0,
      keywordCount: selectedPrimaryKeywordIds.length,
      keywords: selectedPrimaryKeywords.map((keyword) => ({
        normalizedText: keyword.normalizedText ?? keyword.text,
      })),
    };

    await notify({
      stepId: "primary",
      status: "skipped",
      summary:
        primarySelection === "manual"
          ? `${selectedPrimaryKeywordIds.length} manual primary keywords reused`
          : `${selectedPrimaryKeywordIds.length} existing primary keywords reused`,
    });
  } else {
    primaryResult = {
      sourceIds: successfulSourceIds,
      sourceCount: successfulSourceIds.length,
      documentCount: 0,
      keywordCount: 0,
      keywords: [],
    };

    await notify({
      stepId: "primary",
      status: "skipped",
      summary: `Pipeline target reached after ${endAt}`,
    });
  }

  const secondaryDisposition = stageResolver.resolve("secondary");
  if (secondaryDisposition === "run") {
    await assertContinuable();
    await notify({ stepId: "secondary", status: "running" });

    secondaryResult = await generateSecondaryKeywordsForPrimaryKeywords(
      selectedPrimaryKeywordIds,
      limitPerPrimary,
      {
        forceRefresh: secondaryForceRefresh,
        providerMode: primarySelection === "manual" ? "trends" : "suggest",
      },
    );
    selectedSecondaryKeywords = await getReusableSecondaryKeywords(
      selectedPrimaryKeywordIds,
      maxSecondaryAnalyses,
    );
    selectedSecondaryKeywordIds = selectedSecondaryKeywords.map((keyword) => keyword.id);

    await notify({
      stepId: "secondary",
      status: "completed",
      summary: `${selectedSecondaryKeywordIds.length} secondary keywords selected (${secondaryResult.cachedParentKeywordCount} cached, ${secondaryResult.fetchedParentKeywordCount} fetched, ${secondaryResult.failedQueryCount} failed)`,
    });
  } else if (secondaryDisposition === "before") {
    selectedSecondaryKeywords = await getReusableSecondaryKeywords(
      selectedPrimaryKeywordIds,
      maxSecondaryAnalyses,
    );
    selectedSecondaryKeywordIds = selectedSecondaryKeywords.map((keyword) => keyword.id);

    if (selectedSecondaryKeywordIds.length === 0) {
      throw new Error("No reusable secondary keywords found to resume the pipeline");
    }

    secondaryResult = {
      parentKeywordCount: selectedPrimaryKeywordIds.length,
      secondaryKeywordCount: selectedSecondaryKeywordIds.length,
      acceptedSecondaryKeywordCount: selectedSecondaryKeywordIds.length,
      blockedSecondaryKeywordCount: 0,
      cachedParentKeywordCount: selectedPrimaryKeywordIds.length,
      fetchedParentKeywordCount: 0,
      failedQueryCount: 0,
    };

    await notify({
      stepId: "secondary",
      status: "skipped",
      summary: `${selectedSecondaryKeywordIds.length} existing secondary keywords reused`,
    });
  } else {
    secondaryResult = {
      parentKeywordCount: selectedPrimaryKeywordIds.length,
      secondaryKeywordCount: 0,
      acceptedSecondaryKeywordCount: 0,
      blockedSecondaryKeywordCount: 0,
      cachedParentKeywordCount: 0,
      fetchedParentKeywordCount: 0,
      failedQueryCount: 0,
    };

    await notify({
      stepId: "secondary",
      status: "skipped",
      summary: `Pipeline target reached after ${endAt}`,
    });
  }

  const analysisDisposition = stageResolver.resolve("analysis");
  if (analysisDisposition === "run") {
    await assertContinuable();
    await notify({ stepId: "analysis", status: "running" });

    if (skipAnalysis) {
      analysisResult = {
        skipped: true,
        reason: "Analysis disabled from admin batch",
      };
    } else if (!getOpenAIConfigured()) {
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
  } else {
    analysisResult = {
      skipped: true,
      reason:
        analysisDisposition === "before"
          ? "Existing analyzed keywords reused"
          : `Pipeline target reached after ${endAt}`,
    };
    await notify({
      stepId: "analysis",
      status: "skipped",
      summary: analysisResult.reason,
    });
  }

  const pageCandidateKeywordIds = selectedPrimaryKeywordIds;

  const pageDisposition = stageResolver.resolve("pages");
  if (pageDisposition === "run") {
    await assertContinuable();
    await notify({ stepId: "pages", status: "running" });
  } else {
    await notify({
      stepId: "pages",
      status: "skipped",
      summary:
        pageDisposition === "before"
          ? "Existing generated pages reused"
          : `Pipeline target reached after ${endAt}`,
    });
  }

  const pageResult =
    pageDisposition === "run" && pageCandidateKeywordIds.length > 0
      ? await generatePagesForKeywords(pageCandidateKeywordIds)
      : { requestedCount: 0, generatedCount: 0 };

  if (pageDisposition === "run") {
    await notify({
      stepId: "pages",
      status: "completed",
      summary: `${pageResult.generatedCount} pages generated`,
    });
  }

  const publishResults = [];
  const publishDisposition = stageResolver.resolve("publish");

  if (publishDisposition === "run") {
    await assertContinuable();
    await notify({ stepId: "publish", status: "running" });
  } else {
    await notify({
      stepId: "publish",
      status: "skipped",
      summary:
        publishDisposition === "before"
          ? "Publish step not re-run"
          : `Pipeline target reached after ${endAt}`,
    });
  }

  if (publishDisposition === "run" && publishEligible && pageCandidateKeywordIds.length > 0) {
    const generatedPages =
      startFrom === "publish"
        ? await prisma.generatedPage.findMany({
            where: {
              status: GeneratedPageStatus.ready,
            },
            select: {
              id: true,
            },
            orderBy: {
              id: "asc",
            },
          })
        : await prisma.generatedPage.findMany({
            where: {
              keywordId: {
                in: pageCandidateKeywordIds,
              },
            },
            select: {
              id: true,
            },
          });

    for (const page of generatedPages) {
      await assertContinuable();
      try {
        await publishGeneratedPage(page.id);
        publishResults.push({
          ok: true,
          type: "page",
          targetId: page.id,
        });
      } catch (error) {
        publishResults.push({
          ok: false,
          type: "page",
          targetId: page.id,
          error: error instanceof Error ? error.message : "Unknown publish error",
        });
      }
    }
  }

  if (publishDisposition === "run") {
    await notify({
      stepId: "publish",
      status: publishResults.some((entry) => !entry.ok) ? "failed" : "completed",
      summary: `${publishResults.filter((entry) => entry.ok).length} published, ${publishResults.filter((entry) => !entry.ok).length} failed`,
    });
  }

  const cleanupResult =
    cleanupStaleDetailData && primarySelection === "manual"
      ? await cleanupDetailPipelineData({
          retainedPrimaryKeywordIds: selectedPrimaryKeywordIds,
          retainedSecondaryKeywordIds: selectedSecondaryKeywordIds,
        })
      : null;

  return {
    sourceIds,
    startFrom,
    endAt,
    skipIngest,
    primarySelection,
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
    pages: pageResult,
    publish: {
      attempted: publishResults.length,
      succeeded: publishResults.filter((entry) => entry.ok).length,
      failed: publishResults.filter((entry) => !entry.ok).length,
      results: publishResults,
    },
    cleanup: cleanupResult,
  };
}

export async function runTrackedFullPipeline(options: FullPipelineOptions = {}) {
  const skipIngest = options.skipIngest ?? false;
  const sourceIds = skipIngest
    ? []
    : options.sourceIds?.length
      ? options.sourceIds
      : [...DEFAULT_SOURCE_IDS];
  const run = await createPipelineRun(sourceIds);
  const steps = createInitialPipelineSteps();
  const startFrom = options.startFrom ?? "ingest";
  const endAt = options.endAt ?? "publish";
  const stageResolver = createStageDispositionResolver(startFrom, endAt);

  async function syncSteps() {
    await updatePipelineRunSteps(run.id, steps);
  }

  async function appendLog(level: "info" | "warn" | "error", message: string) {
    await appendPipelineRunLog(run.id, {
      timestamp: new Date().toISOString(),
      level,
      message,
    });
  }

  async function assertContinuable() {
    const runtime = await getPipelineRunRuntime(run.id);

    if (!runtime) {
      throw new Error("Pipeline run no longer exists");
    }

    if (runtime.status !== "running") {
      throw new Error(`Pipeline run is no longer running (${runtime.status})`);
    }

    if (runtime.cancelRequested) {
      throw new Error("Pipeline run canceled by admin");
    }
  }

  function updateStep(stepId: PipelineStep["id"], patch: Partial<PipelineStep>) {
    const target = steps.find((step) => step.id === stepId);

    if (!target) {
      return;
    }

    Object.assign(target, patch);
  }

  if (stageResolver.startIndex > 0) {
    const skippedAt = new Date().toISOString();

    for (const step of steps.slice(0, stageResolver.startIndex)) {
      step.status = "skipped";
      step.summary = "Reused previous successful stage output";
      step.finishedAt = skippedAt;
    }

    await syncSteps();
    await appendLog("warn", `Pipeline resumed from stage: ${startFrom}`);
  }

  await appendLog(
    "info",
    `Run mode: ${options.primarySelection === "manual" ? "manual-primary" : "auto"} | ingest ${skipIngest ? "off" : "on"} | start ${startFrom} | end ${endAt}${options.secondaryForceRefresh ? " | secondary refresh on" : ""}`,
  );
  if (options.cleanupStaleDetailData) {
    await appendLog("info", "Detail pipeline cleanup enabled");
  }

  if (stageResolver.endIndex < STAGE_ORDER.length - 1) {
    await appendLog("warn", `Pipeline target stage limited to: ${endAt}`);
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
            update.status === "running" ? current?.startedAt ?? now : current?.startedAt,
          finishedAt:
            update.status === "completed" ||
            update.status === "failed" ||
            update.status === "skipped"
              ? now
              : undefined,
        });
        await syncSteps();
        await appendLog(
          update.status === "failed" ? "error" : update.status === "skipped" ? "warn" : "info",
          `${update.stepId}: ${update.status}${update.summary ? ` - ${update.summary}` : ""}`,
        );
      },
      assertContinuable,
    });

    await completePipelineRun(run.id, steps, {
      ingestedSources: result.ingestion.filter((entry) => entry.ok).length,
      selectedPrimaryKeywords: result.primary.selectedKeywordIds.length,
      selectedSecondaryKeywords: result.secondary.selectedKeywordIds.length,
      analyzedKeywords: "skipped" in result.analysis ? 0 : result.analysis.analyzedCount,
      generatedPages: result.pages.generatedCount,
      publishedItems: result.publish.succeeded,
    });
    if (result.cleanup) {
      await appendLog(
        "info",
        `cleanup: stalePrimary=${result.cleanup.stalePrimaryCount} detachedRelations=${result.cleanup.detachedSuggestRelationCount} deletedPages=${result.cleanup.deletedGeneratedPageCount} deletedSecondary=${result.cleanup.deletedSecondaryCount} deletedTertiary=${result.cleanup.deletedTertiaryCount} trimmedAnalysis=${result.cleanup.trimmedAnalysisCount} trimmedMetric=${result.cleanup.trimmedMetricCount}`,
      );
    }
    await appendLog("info", "Pipeline run completed");

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
    if (message === "Pipeline run canceled by admin") {
      await cancelCompletedPipelineRun(run.id, steps);
      await appendLog("warn", "Pipeline run canceled by admin");
    } else {
      await failPipelineRun(run.id, steps, message);
      await appendLog("error", message);
    }
    throw error;
  }
}
