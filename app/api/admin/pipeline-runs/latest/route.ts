import { NextResponse } from "next/server";

import { getLatestPipelineRun } from "@/lib/pipeline-run";

export async function GET() {
  try {
    const run = await getLatestPipelineRun();

    return NextResponse.json({
      ok: true,
      run,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown pipeline run lookup error",
      },
      { status: 500 },
    );
  }
}
