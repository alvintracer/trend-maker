import { GeneratedPageStatus, HubStatus, KeywordLevel, KeywordStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const PUBLISH_RULES = {
  minRepresentativeOpportunity: 14,
  minSecondaryCount: 1,
  minTertiaryCount: 2,
  minSummaryLength: 60,
} as const;

export async function evaluateHubPublishReadiness(hubId: number) {
  const hub = await prisma.hub.findUnique({
    where: { id: hubId },
    include: {
      representativeKeyword: {
        include: {
          metrics: {
            orderBy: {
              metricDate: "desc",
            },
            take: 1,
          },
          analyses: {
            orderBy: {
              generatedAt: "desc",
            },
            take: 1,
          },
        },
      },
      secondaryKeywords: {
        include: {
          childKeywords: {
            where: {
              level: KeywordLevel.tertiary,
            },
            select: {
              id: true,
            },
          },
        },
      },
      generatedPage: true,
    },
  });

  if (!hub) {
    throw new Error("Hub not found");
  }

  const representative = hub.representativeKeyword;
  const opportunity = representative?.metrics[0]?.opportunityScore ?? 0;
  const secondaryCount = hub.secondaryKeywords.length;
  const tertiaryCount = hub.secondaryKeywords.reduce(
    (total, keyword) => total + keyword.childKeywords.length,
    0,
  );
  const summary =
    hub.summary ?? representative?.analyses[0]?.summary ?? hub.generatedPage?.summary ?? "";
  const hasAnalysis = representative?.status === KeywordStatus.analyzed;
  const hasGeneratedPage = Boolean(hub.generatedPage);

  const blockers: string[] = [];

  if (!representative) {
    blockers.push("No representative keyword");
  }

  if (!hasAnalysis) {
    blockers.push("Representative keyword is not analyzed");
  }

  if (opportunity < PUBLISH_RULES.minRepresentativeOpportunity) {
    blockers.push(`Opportunity is below ${PUBLISH_RULES.minRepresentativeOpportunity}`);
  }

  if (secondaryCount < PUBLISH_RULES.minSecondaryCount) {
    blockers.push(`Secondary count is below ${PUBLISH_RULES.minSecondaryCount}`);
  }

  if (tertiaryCount < PUBLISH_RULES.minTertiaryCount) {
    blockers.push(`Tertiary count is below ${PUBLISH_RULES.minTertiaryCount}`);
  }

  if ((summary ?? "").trim().length < PUBLISH_RULES.minSummaryLength) {
    blockers.push(`Summary is shorter than ${PUBLISH_RULES.minSummaryLength} chars`);
  }

  if (!hasGeneratedPage) {
    blockers.push("Generated page draft is missing");
  }

  return {
    hub,
    eligible: blockers.length === 0,
    blockers,
  };
}

export async function publishHub(hubId: number) {
  const evaluation = await evaluateHubPublishReadiness(hubId);

  if (!evaluation.eligible) {
    throw new Error(`Hub is not publishable: ${evaluation.blockers.join("; ")}`);
  }

  await prisma.hub.update({
    where: { id: hubId },
    data: {
      status: HubStatus.published,
    },
  });

  if (evaluation.hub.generatedPage) {
    await prisma.generatedPage.update({
      where: {
        id: evaluation.hub.generatedPage.id,
      },
      data: {
        status: GeneratedPageStatus.published,
      },
    });
  }
}

export async function unpublishHub(hubId: number) {
  const hub = await prisma.hub.findUnique({
    where: { id: hubId },
    include: {
      generatedPage: true,
    },
  });

  if (!hub) {
    throw new Error("Hub not found");
  }

  await prisma.hub.update({
    where: { id: hubId },
    data: {
      status: HubStatus.ready,
    },
  });

  if (hub.generatedPage) {
    await prisma.generatedPage.update({
      where: {
        id: hub.generatedPage.id,
      },
      data: {
        status: GeneratedPageStatus.ready,
      },
    });
  }
}

export async function publishGeneratedPage(pageId: number) {
  const page = await prisma.generatedPage.findUnique({
    where: { id: pageId },
    include: {
      hub: true,
      keyword: {
        include: {
          metrics: {
            orderBy: {
              metricDate: "desc",
            },
            take: 1,
          },
          analyses: {
            orderBy: {
              generatedAt: "desc",
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!page) {
    throw new Error("Generated page not found");
  }

  if (page.hubId) {
    await publishHub(page.hubId);
    return;
  }

  const opportunity = page.keyword.metrics[0]?.opportunityScore ?? 0;

  if (page.keyword.status !== KeywordStatus.analyzed) {
    throw new Error("Keyword is not analyzed");
  }

  if (opportunity < PUBLISH_RULES.minRepresentativeOpportunity) {
    throw new Error(`Opportunity is below ${PUBLISH_RULES.minRepresentativeOpportunity}`);
  }

  if ((page.summary ?? "").trim().length < PUBLISH_RULES.minSummaryLength) {
    throw new Error(`Summary is shorter than ${PUBLISH_RULES.minSummaryLength} chars`);
  }

  await prisma.generatedPage.update({
    where: { id: pageId },
    data: {
      status: GeneratedPageStatus.published,
    },
  });
}

export async function unpublishGeneratedPage(pageId: number) {
  const page = await prisma.generatedPage.findUnique({
    where: { id: pageId },
  });

  if (!page) {
    throw new Error("Generated page not found");
  }

  await prisma.generatedPage.update({
    where: { id: pageId },
    data: {
      status: GeneratedPageStatus.ready,
    },
  });
}

export function getPublishRules() {
  return PUBLISH_RULES;
}
