import { NextResponse } from "next/server";

import { runTrackedFullPipeline } from "@/lib/full-pipeline-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          sourceIds?: string[];
          maxPrimaryKeywords?: number;
          maxSecondaryAnalyses?: number;
          limitPerPrimary?: number;
          publishEligible?: boolean;
          startFrom?:
            | "ingest"
            | "primary"
            | "secondary"
            | "analysis"
            | "hubs"
            | "pages"
            | "publish";
        }
      | null;

    const result = await runTrackedFullPipeline({
      sourceIds: body?.sourceIds,
      maxPrimaryKeywords: body?.maxPrimaryKeywords,
      maxSecondaryAnalyses: body?.maxSecondaryAnalyses,
      limitPerPrimary: body?.limitPerPrimary,
      publishEligible: body?.publishEligible,
      startFrom: body?.startFrom,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown full pipeline error",
      },
      { status: 400 },
    );
  }
}
