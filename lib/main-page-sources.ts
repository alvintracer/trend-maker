import { ingestSource } from "@/lib/ingestion-service";
import { prisma } from "@/lib/prisma";

export const MAIN_PAGE_SOURCE_IDS = [
  "dcinside-dcbest-lite",
  "fmkorea-best2",
  "arca-live",
  "dogdrip-popular",
  "dogdrip-userdog",
] as const;

export type MainPageSourceId = (typeof MAIN_PAGE_SOURCE_IDS)[number];

export type MainPageSourceSetting = {
  sourceExternalId: string;
  enabled: boolean;
  intervalHours: number;
};

const DEFAULT_INTERVAL_HOURS = 6;

function isValidIntervalHours(value: number) {
  return Number.isFinite(value) && value >= 1 && value <= 168;
}

function getMainPageSourceSettingDelegate() {
  const delegate = (prisma as typeof prisma & {
    mainPageSourceSetting?: {
      findMany: (args: {
        where: {
          sourceExternalId: {
            in: string[];
          };
        };
      }) => Promise<
        Array<{
          sourceExternalId: string;
          enabled: boolean;
          intervalHours: number;
        }>
      >;
      upsert: (args: {
        where: {
          sourceExternalId: string;
        };
        update: {
          enabled: boolean;
          intervalHours: number;
        };
        create: {
          sourceExternalId: string;
          enabled: boolean;
          intervalHours: number;
        };
      }) => Promise<unknown>;
    };
  }).mainPageSourceSetting;

  return delegate ?? null;
}

async function hasSettingsTable() {
  try {
    const rows = (await prisma.$queryRaw<{ exists: string | null }[]>`
      SELECT to_regclass('trend_maker."MainPageSourceSetting"')::text AS exists
    `) as Array<{ exists: string | null }>;

    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

export async function getMainPageSourceSettings() {
  const settingsTableExists = await hasSettingsTable();
  const delegate = getMainPageSourceSettingDelegate();

  if (!settingsTableExists || !delegate) {
    return MAIN_PAGE_SOURCE_IDS.map((sourceExternalId) => ({
      sourceExternalId,
      enabled: true,
      intervalHours: DEFAULT_INTERVAL_HOURS,
    }));
  }

  const settings = await delegate.findMany({
    where: {
      sourceExternalId: {
        in: [...MAIN_PAGE_SOURCE_IDS],
      },
    },
  });
  const settingMap = new Map(settings.map((setting) => [setting.sourceExternalId, setting]));

  return MAIN_PAGE_SOURCE_IDS.map((sourceExternalId) => ({
    sourceExternalId,
    enabled: settingMap.get(sourceExternalId)?.enabled ?? true,
    intervalHours: settingMap.get(sourceExternalId)?.intervalHours ?? DEFAULT_INTERVAL_HOURS,
  }));
}

export async function updateMainPageSourceSetting(input: MainPageSourceSetting) {
  if (!MAIN_PAGE_SOURCE_IDS.includes(input.sourceExternalId as MainPageSourceId)) {
    throw new Error(`Unknown main page source: ${input.sourceExternalId}`);
  }

  if (!isValidIntervalHours(input.intervalHours)) {
    throw new Error("Interval hours must be between 1 and 168");
  }

  const delegate = getMainPageSourceSettingDelegate();

  if (!delegate) {
    throw new Error("Prisma client is outdated. Restart the dev server and try again.");
  }

  await delegate.upsert({
    where: {
      sourceExternalId: input.sourceExternalId,
    },
    update: {
      enabled: input.enabled,
      intervalHours: input.intervalHours,
    },
    create: {
      sourceExternalId: input.sourceExternalId,
      enabled: input.enabled,
      intervalHours: input.intervalHours,
    },
  });
}

export async function runMainPageSourceRefresh(sourceExternalIds?: string[]) {
  const targetSourceIds =
    sourceExternalIds && sourceExternalIds.length > 0
      ? sourceExternalIds
      : [...MAIN_PAGE_SOURCE_IDS];

  const results = [];

  for (const sourceExternalId of targetSourceIds) {
    results.push(await ingestSource(sourceExternalId));
  }

  return results;
}

export async function runScheduledMainPageSourceRefresh() {
  const settings = await getMainPageSourceSettings();
  const sources = await prisma.source.findMany({
    where: {
      externalId: {
        in: [...MAIN_PAGE_SOURCE_IDS],
      },
    },
    select: {
      externalId: true,
      lastCrawledAt: true,
    },
  });
  const sourceMap = new Map(sources.map((source) => [source.externalId, source]));
  const dueSourceIds = settings
    .filter((setting) => setting.enabled)
    .filter((setting) => {
      const source = sourceMap.get(setting.sourceExternalId);

      if (!source?.lastCrawledAt) {
        return true;
      }

      const nextRunAt =
        source.lastCrawledAt.getTime() + setting.intervalHours * 60 * 60 * 1000;
      return Date.now() >= nextRunAt;
    })
    .map((setting) => setting.sourceExternalId);

  if (dueSourceIds.length === 0) {
    return [];
  }

  return runMainPageSourceRefresh(dueSourceIds);
}
