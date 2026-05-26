import { prisma } from "@/lib/prisma";
import { adSlotDefinitions, getAdSlotDefinition, type AdSlotKey } from "@/lib/adsterra";

export type AdSlotSettingsMap = Record<AdSlotKey, boolean>;

function getDefaultSettingsMap(): AdSlotSettingsMap {
  return Object.fromEntries(
    adSlotDefinitions.map((slot) => [slot.key, slot.defaultEnabled]),
  ) as AdSlotSettingsMap;
}

export async function getAdSlotSettingsMap(): Promise<AdSlotSettingsMap> {
  const defaults = getDefaultSettingsMap();

  try {
    const tablePresence = (await prisma.$queryRaw<{ exists: string | null }[]>`
      SELECT to_regclass('trend_maker."AdSlotSetting"')::text AS exists
    `) as Array<{ exists: string | null }>;

    if (!tablePresence[0]?.exists) {
      return defaults;
    }

    const settings = await prisma.adSlotSetting.findMany();

    for (const setting of settings) {
      if (setting.slotKey in defaults) {
        defaults[setting.slotKey as AdSlotKey] = setting.enabled;
      }
    }

    return defaults;
  } catch {
    return defaults;
  }
}

export async function setAdSlotEnabled(slotKey: AdSlotKey, enabled: boolean) {
  getAdSlotDefinition(slotKey);

  await prisma.adSlotSetting.upsert({
    where: {
      slotKey,
    },
    update: {
      enabled,
    },
    create: {
      slotKey,
      enabled,
    },
  });
}
