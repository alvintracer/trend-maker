import { NextResponse } from "next/server";

import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { getLatestPipelineRun } from "@/lib/pipeline-run";

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
