import { NextResponse } from "next/server";

import { runScheduledMainPageSourceRefresh } from "@/lib/main-page-sources";

function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");

  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  return vercelCronHeader === "1";
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runScheduledMainPageSourceRefresh();

    return NextResponse.json({
      ok: true,
      ran: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown cron error",
      },
      { status: 500 },
    );
  }
}
