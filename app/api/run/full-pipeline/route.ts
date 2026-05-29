import { after, NextResponse } from "next/server";

import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { runTrackedFullPipeline } from "@/lib/full-pipeline-service";

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as
        | {
          sourceIds?: string[];
          maxPrimaryKeywords?: number;
          maxSecondaryAnalyses?: number;
          limitPerPrimary?: number;
          publishEligible?: boolean;
          endAt?:
            | "ingest"
            | "primary"
            | "secondary"
            | "analysis"
            | "pages"
            | "publish";
          skipIngest?: boolean;
          primarySelection?: "auto" | "manual";
          secondaryForceRefresh?: boolean;
          skipAnalysis?: boolean;
          startFrom?:
            | "ingest"
            | "primary"
            | "secondary"
            | "analysis"
            | "pages"
            | "publish";
        }
      | null;

    const options = {
      sourceIds: body?.sourceIds,
      maxPrimaryKeywords: body?.maxPrimaryKeywords,
      maxSecondaryAnalyses: body?.maxSecondaryAnalyses,
      limitPerPrimary: body?.limitPerPrimary,
      publishEligible: body?.publishEligible,
      endAt: body?.endAt,
      skipIngest: body?.skipIngest,
      primarySelection: body?.primarySelection,
      secondaryForceRefresh: body?.secondaryForceRefresh,
      skipAnalysis: body?.skipAnalysis,
      startFrom: body?.startFrom,
    };

    after(async () => {
      try {
        await runTrackedFullPipeline(options);
      } catch (error) {
        console.error("full pipeline background run failed", error);
      }
    });

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        message: "Pipeline execution scheduled",
      },
      { status: 202 },
    );
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
