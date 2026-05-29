import { GeneratedPageStatus, HubStatus, KeywordLevel, KeywordStatus } from "@prisma/client";

import { DEFAULT_PUBLISH_RULES, getPublishRules } from "@/lib/publish-settings";
import { prisma } from "@/lib/prisma";

export async function evaluateHubPublishReadiness(hubId: number) {
  const publishRules = await getPublishRules();
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

  if (opportunity < publishRules.minRepresentativeOpportunity) {
    blockers.push(`Opportunity is below ${publishRules.minRepresentativeOpportunity}`);
  }

  if (secondaryCount < publishRules.minSecondaryCount) {
    blockers.push(`Secondary count is below ${publishRules.minSecondaryCount}`);
  }

  if (tertiaryCount < publishRules.minTertiaryCount) {
    blockers.push(`Tertiary count is below ${publishRules.minTertiaryCount}`);
  }

  if ((summary ?? "").trim().length < publishRules.minSummaryLength) {
    blockers.push(`Summary is shorter than ${publishRules.minSummaryLength} chars`);
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
  const publishRules = await getPublishRules();
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

  if (
    page.keyword.status !== KeywordStatus.tracking &&
    page.keyword.status !== KeywordStatus.analyzed
  ) {
    throw new Error("Keyword is not eligible for publish");
  }

  if (opportunity < publishRules.minRepresentativeOpportunity) {
    throw new Error(`Opportunity is below ${publishRules.minRepresentativeOpportunity}`);
  }

  if ((page.summary ?? "").trim().length < publishRules.minSummaryLength) {
    throw new Error(`Summary is shorter than ${publishRules.minSummaryLength} chars`);
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

export async function getPublishRulesForDisplay() {
  return getPublishRules();
}

export function getDefaultPublishRules() {
  return DEFAULT_PUBLISH_RULES;
}
