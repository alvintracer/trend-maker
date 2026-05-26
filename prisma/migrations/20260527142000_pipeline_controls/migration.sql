ALTER TYPE "trend_maker"."PipelineRunStatus" ADD VALUE IF NOT EXISTS 'canceled';

ALTER TABLE "trend_maker"."PipelineRun"
ADD COLUMN IF NOT EXISTS "logsJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "cancelRequested" BOOLEAN NOT NULL DEFAULT false;
