CREATE TYPE "trend_maker"."PipelineRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

CREATE TABLE "trend_maker"."PipelineRun" (
    "id" SERIAL NOT NULL,
    "status" "trend_maker"."PipelineRunStatus" NOT NULL DEFAULT 'queued',
    "sourceIdsRaw" TEXT,
    "stepsJson" TEXT NOT NULL,
    "summaryJson" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PipelineRun_status_startedAt_idx" ON "trend_maker"."PipelineRun"("status", "startedAt");
