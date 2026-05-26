import { NextResponse } from "next/server";

import { getSources } from "@/lib/source-repository";

export async function GET() {
  const items = await getSources();

  return NextResponse.json({
    count: items.length,
    items,
  });
}
