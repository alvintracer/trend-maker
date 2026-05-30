import { NextResponse } from "next/server";

import { ingestSource } from "@/lib/ingestion-service";
import { runTrackedFullPipeline } from "@/lib/full-pipeline-service";

function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");

  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  return vercelCronHeader === "1";
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dcbestIngest = await ingestSource("dcinside-dcbest");
    const result = await runTrackedFullPipeline({
      skipIngest: true,
      startFrom: "primary",
      endAt: "publish",
      primarySelection: "manual",
      secondaryForceRefresh: true,
      publishEligible: true,
      maxPrimaryKeywords: 30,
      maxSecondaryAnalyses: 60,
      limitPerPrimary: 10,
      cleanupStaleDetailData: true,
    });

    return NextResponse.json({
      ok: true,
      mode: "detail-cron",
      dcbestIngest: {
        fetchedCount: dcbestIngest.fetchedCount,
        storedCount: dcbestIngest.storedCount,
        method: dcbestIngest.method,
      },
      pipelineRunId: result.runId,
      cleanup: result.cleanup,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown detail cron error",
      },
      { status: 500 },
    );
  }
}
