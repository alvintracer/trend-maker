import { ADSTERRA_SMARTLINK_URL } from "@/lib/adsterra";
import { prisma } from "@/lib/prisma";

const DEFAULT_SCOPE = "default";

export type TrafficRedirectSettings = {
  enabled: boolean;
  smartlinkUrl: string;
};

export const DEFAULT_TRAFFIC_REDIRECT_SETTINGS: TrafficRedirectSettings = {
  enabled: false,
  smartlinkUrl: ADSTERRA_SMARTLINK_URL,
};

export async function getTrafficRedirectSettings(): Promise<TrafficRedirectSettings> {
  try {
    const tablePresence = (await prisma.$queryRaw<{ exists: string | null }[]>`
      SELECT to_regclass('trend_maker."TrafficRedirectSetting"')::text AS exists
    `) as Array<{ exists: string | null }>;

    if (!tablePresence[0]?.exists) {
      return DEFAULT_TRAFFIC_REDIRECT_SETTINGS;
    }

    const settings = (await prisma.$queryRaw<
      Array<{ enabled: boolean | null; smartlinkUrl: string | null }>
    >`
      SELECT "enabled", "smartlinkUrl"
      FROM "trend_maker"."TrafficRedirectSetting"
      WHERE "scope" = ${DEFAULT_SCOPE}
      LIMIT 1
    `) as Array<{ enabled: boolean | null; smartlinkUrl: string | null }>;

    const setting = settings[0] ?? null;

    return {
      enabled: setting?.enabled ?? DEFAULT_TRAFFIC_REDIRECT_SETTINGS.enabled,
      smartlinkUrl: setting?.smartlinkUrl?.trim() || ADSTERRA_SMARTLINK_URL,
    };
  } catch {
    return DEFAULT_TRAFFIC_REDIRECT_SETTINGS;
  }
}

export async function setTrafficRedirectSettings(settings: TrafficRedirectSettings) {
  await prisma.$executeRaw`
    INSERT INTO "trend_maker"."TrafficRedirectSetting" (
      "scope",
      "enabled",
      "smartlinkUrl",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${DEFAULT_SCOPE},
      ${settings.enabled},
      ${settings.smartlinkUrl || ADSTERRA_SMARTLINK_URL},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("scope")
    DO UPDATE SET
      "enabled" = EXCLUDED."enabled",
      "smartlinkUrl" = EXCLUDED."smartlinkUrl",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}
