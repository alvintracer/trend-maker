import { NextResponse } from "next/server";

import { ingestSource } from "@/lib/ingestion-service";

type RouteContext = {
  params: Promise<{
    sourceId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sourceId } = await context.params;

  try {
    const result = await ingestSource(sourceId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown ingestion error",
      },
      { status: 400 },
    );
  }
}
