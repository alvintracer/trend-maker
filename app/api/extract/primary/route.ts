import { NextResponse } from "next/server";

import { generatePrimaryKeywordsForSources } from "@/lib/keyword-service";

const DEFAULT_SOURCE_IDS = ["dcinside", "fmkorea", "mlbpark", "dogdrip"];

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { sourceIds?: string[] }
      | null;
    const sourceIds = body?.sourceIds?.length ? body.sourceIds : DEFAULT_SOURCE_IDS;
    const result = await generatePrimaryKeywordsForSources(sourceIds);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown keyword extraction error",
      },
      { status: 400 },
    );
  }
}
