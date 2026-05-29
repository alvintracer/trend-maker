import { PipelineRunStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PipelineStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type PipelineStep = {
  id: string;
  label: string;
  status: PipelineStepStatus;
  startedAt?: string;
  finishedAt?: string;
  summary?: string;
  error?: string;
};

export type PipelineLogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
};

type PipelineSummary = {
  ingestedSources?: number;
  selectedPrimaryKeywords?: number;
  selectedSecondaryKeywords?: number;
  analyzedKeywords?: number;
  generatedPages?: number;
  publishedItems?: number;
};

const defaultStepSpecs = [
  { id: "ingest", label: "Source Ingestion" },
  { id: "primary", label: "Primary Keywords" },
  { id: "secondary", label: "Secondary Keywords" },
  { id: "analysis", label: "Keyword Analysis" },
  { id: "pages", label: "Page Generation" },
  { id: "publish", label: "Publish Eligible Items" },
] as const;

export function createInitialPipelineSteps(): PipelineStep[] {
  return defaultStepSpecs.map((step) => ({
    id: step.id,
    label: step.label,
    status: "pending",
  }));
}

function serializeJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value?: string | null, fallback?: T): T {
  if (!value) {
    return fallback as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback as T;
  }
}

function normalizeRun(run: {
  id: number;
  status: PipelineRunStatus;
  sourceIdsRaw: string | null;
  stepsJson: string;
  logsJson: string;
  summaryJson: string | null;
  error: string | null;
  cancelRequested: boolean;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: run.id,
    status: run.status,
    sourceIds: parseJson<string[]>(run.sourceIdsRaw, []),
    steps: parseJson<PipelineStep[]>(run.stepsJson, createInitialPipelineSteps()),
    logs: parseJson<PipelineLogEntry[]>(run.logsJson, []),
    summary: parseJson<PipelineSummary | null>(run.summaryJson, null),
    error: run.error,
    cancelRequested: run.cancelRequested,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export async function createPipelineRun(sourceIds: string[]) {
  const run = await prisma.pipelineRun.create({
    data: {
      status: PipelineRunStatus.running,
      sourceIdsRaw: serializeJson(sourceIds),
      stepsJson: serializeJson(createInitialPipelineSteps()),
      logsJson: serializeJson([
        {
          timestamp: new Date().toISOString(),
          level: "info",
          message: "Pipeline run created",
        },
      ] satisfies PipelineLogEntry[]),
    },
  });

  return normalizeRun(run);
}

export async function updatePipelineRunSteps(runId: number, steps: PipelineStep[]) {
  const run = await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      stepsJson: serializeJson(steps),
    },
  });

  return normalizeRun(run);
}

export async function appendPipelineRunLog(
  runId: number,
  entry: PipelineLogEntry,
) {
  const current = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    select: { logsJson: true },
  });

  if (!current) {
    return null;
  }

  const logs = parseJson<PipelineLogEntry[]>(current.logsJson, []);
  logs.push(entry);

  const run = await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      logsJson: serializeJson(logs.slice(-200)),
    },
  });

  return normalizeRun(run);
}

export async function completePipelineRun(runId: number, steps: PipelineStep[], summary: PipelineSummary) {
  const run = await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      status: PipelineRunStatus.completed,
      stepsJson: serializeJson(steps),
      summaryJson: serializeJson(summary),
      finishedAt: new Date(),
      error: null,
      cancelRequested: false,
    },
  });

  return normalizeRun(run);
}

export async function failPipelineRun(
  runId: number,
  steps: PipelineStep[],
  error: string,
  summary?: PipelineSummary,
) {
  const run = await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      status: PipelineRunStatus.failed,
      stepsJson: serializeJson(steps),
      summaryJson: summary ? serializeJson(summary) : null,
      error,
      finishedAt: new Date(),
      cancelRequested: false,
    },
  });

  return normalizeRun(run);
}

export async function cancelPipelineRun(runId: number) {
  const run = await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      cancelRequested: true,
    },
  });

  return normalizeRun(run);
}

export async function forceReleasePipelineRun(runId: number) {
  const run = await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      status: PipelineRunStatus.failed,
      cancelRequested: false,
      finishedAt: new Date(),
      error: "Force released from admin",
    },
  });

  return normalizeRun(run);
}

export async function cancelCompletedPipelineRun(runId: number, steps: PipelineStep[]) {
  const run = await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      status: PipelineRunStatus.canceled,
      stepsJson: serializeJson(steps),
      finishedAt: new Date(),
      cancelRequested: false,
      error: "Canceled from admin",
    },
  });

  return normalizeRun(run);
}

export async function getPipelineRunRuntime(runId: number) {
  return prisma.pipelineRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      cancelRequested: true,
    },
  });
}

export async function getLatestPipelineRun() {
  const tablePresence = (await prisma.$queryRaw<{ exists: string | null }[]>`
    SELECT to_regclass('trend_maker."PipelineRun"')::text AS exists
  `) as Array<{ exists: string | null }>;

  if (!tablePresence[0]?.exists) {
    return null;
  }

  try {
    const run = await prisma.pipelineRun.findFirst({
      orderBy: {
        startedAt: "desc",
      },
    });

    return run ? normalizeRun(run) : null;
  } catch {
    return null;
  }
}
