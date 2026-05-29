import { prisma } from "@/lib/prisma";

const DEFAULT_SCOPE = "default";

export const DEFAULT_PUBLISH_RULES = {
  minRepresentativeOpportunity: 14,
  minSecondaryCount: 1,
  minTertiaryCount: 2,
  minSummaryLength: 60,
} as const;

export type PublishRules = {
  minRepresentativeOpportunity: number;
  minSecondaryCount: number;
  minTertiaryCount: number;
  minSummaryLength: number;
};

export async function getPublishRules(): Promise<PublishRules> {
  try {
    const tablePresence = (await prisma.$queryRaw<{ exists: string | null }[]>`
      SELECT to_regclass('trend_maker."PublishSetting"')::text AS exists
    `) as Array<{ exists: string | null }>;

    if (!tablePresence[0]?.exists) {
      return DEFAULT_PUBLISH_RULES;
    }

    const settings = (await prisma.$queryRaw<
      Array<{ minRepresentativeOpportunity: number | null }>
    >`
      SELECT "minRepresentativeOpportunity"
      FROM "trend_maker"."PublishSetting"
      WHERE "scope" = ${DEFAULT_SCOPE}
      LIMIT 1
    `) as Array<{ minRepresentativeOpportunity: number | null }>;

    const setting = settings[0] ?? null;

    return {
      ...DEFAULT_PUBLISH_RULES,
      minRepresentativeOpportunity:
        setting?.minRepresentativeOpportunity ?? DEFAULT_PUBLISH_RULES.minRepresentativeOpportunity,
    };
  } catch {
    return DEFAULT_PUBLISH_RULES;
  }
}

export async function setPublishMinRepresentativeOpportunity(value: number) {
  await prisma.$executeRaw`
    INSERT INTO "trend_maker"."PublishSetting" (
      "scope",
      "minRepresentativeOpportunity",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${DEFAULT_SCOPE},
      ${value},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("scope")
    DO UPDATE SET
      "minRepresentativeOpportunity" = EXCLUDED."minRepresentativeOpportunity",
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}
