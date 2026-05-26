import { NextResponse } from "next/server";

import { generateKeywordAnalysesForKeywords } from "@/lib/keyword-analysis-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { keywordIds?: number[] }
      | null;
    const keywordIds = body?.keywordIds ?? [];

    if (keywordIds.length === 0) {
      throw new Error("keywordIds is required");
    }

    const result = await generateKeywordAnalysesForKeywords(keywordIds);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown keyword analysis error",
      },
      { status: 400 },
    );
  }
}
