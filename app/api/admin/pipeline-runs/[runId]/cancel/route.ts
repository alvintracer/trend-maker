import { NextResponse } from "next/server";

import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { cancelPipelineRun } from "@/lib/pipeline-run";

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
    const result = await cancelPipelineRun(Number(runId));

    return NextResponse.json({
      ok: true,
      run: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown pipeline cancel error",
      },
      { status: 400 },
    );
  }
}
