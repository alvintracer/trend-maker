import { NextResponse } from "next/server";

import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { forceReleasePipelineRun } from "@/lib/pipeline-run";

type RouteContext = {
  params: Promise<{
    runId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  if (!isAdminRequestAuthenticated(_request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runId } = await context.params;
    const result = await forceReleasePipelineRun(Number(runId));

    return NextResponse.json({
      ok: true,
      run: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown pipeline force release error",
      },
      { status: 400 },
    );
  }
}
