import { NextResponse } from "next/server";

import { pipelineStages } from "@/lib/seed-data";

export function GET() {
  return NextResponse.json({
    count: pipelineStages.length,
    items: pipelineStages,
  });
}
