import { NextResponse } from "next/server";

import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { runMainPageSourceRefresh, updateMainPageSourceSetting } from "@/lib/main-page-sources";

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    sourceExternalId?: string;
  };

  try {
    const results = await runMainPageSourceRefresh(
      body.sourceExternalId ? [body.sourceExternalId] : undefined,
    );

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown main page refresh error",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        sourceExternalId?: string;
        enabled?: boolean;
        intervalHours?: number;
      }
    | null;

  if (
    !body?.sourceExternalId ||
    typeof body.enabled !== "boolean" ||
    typeof body.intervalHours !== "number"
  ) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  try {
    await updateMainPageSourceSetting({
      sourceExternalId: body.sourceExternalId,
      enabled: body.enabled,
      intervalHours: body.intervalHours,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown settings update error",
      },
      { status: 400 },
    );
  }
}
