import { KeywordLevel, KeywordStatus } from "@prisma/client";

import { parseKeywordSourceIds } from "@/lib/keyword-repository";
import { prisma } from "@/lib/prisma";

type GeneratedKeywordAnalysis = {
  intent: string;
  summary: string;
  relatedKeywords: string[];
  faq: string[];
  snippetTitle: string;
  snippetDescription: string;
  commercialScore: number;
};

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.4";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for keyword analysis");
  }

  return {
    apiKey,
    model,
  };
}

function normalizeGeneratedKeyword(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function generateKeywordAnalysisWithOpenAI(input: {
  keyword: string;
  region: string;
  language: string;
  sourceNames: string[];
}) {
  const { apiKey, model } = getOpenAIConfig();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content:
            "You analyze Korean search keywords for SEO research. Return valid JSON only.",
        },
        {
          role: "user",
          content: [
            `keyword: ${input.keyword}`,
            `region: ${input.region}`,
            `language: ${input.language}`,
            `source context: ${input.sourceNames.join(", ") || "unknown"}`,
            "",
            "Return a JSON object with these keys:",
            "intent: short string",
            "summary: 2-3 sentence analysis in Korean",
            "relatedKeywords: array of 4 to 8 Korean keyword strings",
            "faq: array of 3 to 5 Korean user questions",
            "snippetTitle: concise Korean title under 35 chars",
            "snippetDescription: concise Korean description under 110 chars",
            "commercialScore: integer 0 to 10",
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI analysis request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI analysis response was empty");
  }

  const parsed = JSON.parse(content) as Partial<GeneratedKeywordAnalysis>;

  return {
    model,
    analysis: {
      intent: String(parsed.intent ?? "").trim(),
      summary: String(parsed.summary ?? "").trim(),
      relatedKeywords: Array.isArray(parsed.relatedKeywords)
        ? parsed.relatedKeywords.map((value) => normalizeGeneratedKeyword(String(value))).filter(Boolean)
        : [],
      faq: Array.isArray(parsed.faq)
        ? parsed.faq.map((value) => normalizeGeneratedKeyword(String(value))).filter(Boolean)
        : [],
      snippetTitle: normalizeGeneratedKeyword(String(parsed.snippetTitle ?? "")),
      snippetDescription: normalizeGeneratedKeyword(String(parsed.snippetDescription ?? "")),
      commercialScore: Math.max(0, Math.min(10, Number(parsed.commercialScore ?? 0) || 0)),
    },
  };
}

export async function generateKeywordAnalysesForKeywords(keywordIds: number[]) {
  const keywords = await prisma.keyword.findMany({
    where: {
      id: {
        in: keywordIds,
      },
      level: KeywordLevel.secondary,
      status: {
        in: [KeywordStatus.tracking, KeywordStatus.analyzed],
      },
    },
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
  });

  if (keywords.length === 0) {
    throw new Error("No eligible secondary keywords found for analysis");
  }

  const sources = await prisma.source.findMany({
    select: {
      externalId: true,
      name: true,
    },
  });
  const sourceNameById = new Map(sources.map((source) => [source.externalId, source.name]));

  let analyzedCount = 0;
  let tertiaryKeywordCount = 0;

  for (const keyword of keywords) {
    const sourceNames = parseKeywordSourceIds(keyword.sourceIdsRaw)
      .map((sourceId) => sourceNameById.get(sourceId))
      .filter((value): value is string => Boolean(value));
    const generated = await generateKeywordAnalysisWithOpenAI({
      keyword: keyword.text,
      region: keyword.region,
      language: keyword.language,
      sourceNames,
    });

    await prisma.keywordAnalysis.create({
      data: {
        keywordId: keyword.id,
        intent: generated.analysis.intent,
        summary: generated.analysis.summary,
        relatedKeywordsRaw: JSON.stringify(generated.analysis.relatedKeywords),
        faqRaw: JSON.stringify(generated.analysis.faq),
        snippetTitle: generated.analysis.snippetTitle,
        snippetDescription: generated.analysis.snippetDescription,
        model: generated.model,
      },
    });

    await prisma.keyword.update({
      where: {
        id: keyword.id,
      },
      data: {
        status: KeywordStatus.analyzed,
      },
    });

    analyzedCount += 1;

    for (const relatedKeyword of generated.analysis.relatedKeywords.slice(0, 6)) {
      const normalizedText = relatedKeyword.toLowerCase();

      const tertiaryKeyword = await prisma.keyword.upsert({
        where: {
          normalizedText,
        },
        update: {
          text: relatedKeyword,
          level: KeywordLevel.tertiary,
          parentKeywordId: keyword.id,
          sourceIdsRaw: keyword.sourceIdsRaw,
          sourceLabel: "openai_analysis",
          lastSeenAt: new Date(),
          status: KeywordStatus.tracking,
        },
        create: {
          text: relatedKeyword,
          normalizedText,
          level: KeywordLevel.tertiary,
          parentKeywordId: keyword.id,
          region: keyword.region,
          language: keyword.language,
          sourceIdsRaw: keyword.sourceIdsRaw,
          sourceLabel: "openai_analysis",
          status: KeywordStatus.tracking,
        },
      });

      await prisma.keywordMetric.upsert({
        where: {
          keywordId_metricDate: {
            keywordId: tertiaryKeyword.id,
            metricDate: startOfToday(),
          },
        },
        update: {
          frequencyScore: 1,
          trendScore: keyword.metrics[0]?.trendScore ?? 0,
          sourceCount: parseKeywordSourceIds(keyword.sourceIdsRaw).length,
          suggestScore: keyword.metrics[0]?.suggestScore ?? 0,
          commercialScore: generated.analysis.commercialScore,
          opportunityScore: Math.max(
            generated.analysis.commercialScore + 5,
            (keyword.metrics[0]?.opportunityScore ?? 0) * 0.75,
          ),
        },
        create: {
          keywordId: tertiaryKeyword.id,
          metricDate: startOfToday(),
          frequencyScore: 1,
          trendScore: keyword.metrics[0]?.trendScore ?? 0,
          sourceCount: parseKeywordSourceIds(keyword.sourceIdsRaw).length,
          suggestScore: keyword.metrics[0]?.suggestScore ?? 0,
          commercialScore: generated.analysis.commercialScore,
          opportunityScore: Math.max(
            generated.analysis.commercialScore + 5,
            (keyword.metrics[0]?.opportunityScore ?? 0) * 0.75,
          ),
        },
      });

      tertiaryKeywordCount += 1;
    }
  }

  return {
    analyzedCount,
    tertiaryKeywordCount,
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getLatestKeywordAnalysis(keywordId: number) {
  return prisma.keywordAnalysis.findFirst({
    where: {
      keywordId,
    },
    orderBy: {
      generatedAt: "desc",
    },
  });
}
