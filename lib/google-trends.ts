import { normalizeKeyword, normalizeKeywordLoose, normalizeWhitespace } from "@/lib/normalize";
import type { SecondaryKeywordCandidate } from "@/lib/types";

const GOOGLE_TRENDS_BASE_URL = "https://trends.google.com/trends";
const GOOGLE_TRENDS_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
};

type GoogleTrendsContext = {
  geo: string;
  hl: string;
  tz: number;
};

type GoogleTrendsWidget = {
  id: string;
  token: string;
  request: Record<string, unknown>;
};

export async function fetchGoogleTrendsRelatedQueryCandidates(
  parentKeywordId: number,
  keyword: string,
  region = "KR",
  language = "ko",
  options: {
    timeframe?: string;
    topLimit?: number;
    risingLimit?: number;
  } = {},
) {
  const timeframe = options.timeframe ?? "now 7-d";
  const topLimit = options.topLimit ?? 50;
  const risingLimit = options.risingLimit ?? 50;
  const context = getGoogleTrendsContext(region, language);
  const cookie = await getGoogleTrendsCookie(context);
  const widget = await fetchRelatedQueriesWidget(keyword, context, cookie, timeframe);
  const rankedLists = await fetchRankedQueries(widget, context, cookie);

  const dedupedByProvider = new Set<string>();
  const candidates: SecondaryKeywordCandidate[] = [];

  rankedLists.top.slice(0, topLimit).forEach((item, index) => {
    const queryText = item.query ?? "";
    const normalizedText = normalizeKeyword(normalizeKeywordLoose(queryText));
    const key = `top:${normalizedText}`;

    if (!shouldKeepTrendCandidate(keyword, queryText, normalizedText) || dedupedByProvider.has(key)) {
      return;
    }

    dedupedByProvider.add(key);
    candidates.push({
      parentKeywordId,
      query: keyword,
      text: normalizeWhitespace(queryText),
      normalizedText,
      rank: index + 1,
      provider: "google_trends_top",
    });
  });

  rankedLists.rising.slice(0, risingLimit).forEach((item, index) => {
    const queryText = item.query ?? "";
    const normalizedText = normalizeKeyword(normalizeKeywordLoose(queryText));
    const key = `rising:${normalizedText}`;

    if (!shouldKeepTrendCandidate(keyword, queryText, normalizedText) || dedupedByProvider.has(key)) {
      return;
    }

    dedupedByProvider.add(key);
    candidates.push({
      parentKeywordId,
      query: keyword,
      text: normalizeWhitespace(queryText),
      normalizedText,
      rank: index + 1,
      provider: "google_trends_rising",
    });
  });

  return candidates;
}

function getGoogleTrendsContext(region: string, language: string): GoogleTrendsContext {
  if (region === "JP" || language === "ja") {
    return {
      geo: "JP",
      hl: "ja-JP",
      tz: -540,
    };
  }

  return {
    geo: "KR",
    hl: "ko-KR",
    tz: -540,
  };
}

async function getGoogleTrendsCookie(context: GoogleTrendsContext) {
  const response = await fetch(`${GOOGLE_TRENDS_BASE_URL}/explore/?geo=${context.geo}`, {
    headers: GOOGLE_TRENDS_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  const headerEntries =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  if (headerEntries.length === 0) {
    return "";
  }

  return headerEntries
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim())
    .filter((part) => part.startsWith("NID="))
    .map((part) => part.split(";")[0] ?? "")
    .filter(Boolean)
    .join("; ");
}

async function fetchRelatedQueriesWidget(
  keyword: string,
  context: GoogleTrendsContext,
  cookie: string,
  timeframe: string,
) {
  const req = {
    comparisonItem: [
      {
        keyword,
        geo: context.geo,
        time: timeframe,
      },
    ],
    category: 0,
    property: "",
  };

  const response = await fetch(
    `${GOOGLE_TRENDS_BASE_URL}/api/explore?hl=${encodeURIComponent(context.hl)}&tz=${context.tz}&req=${encodeURIComponent(JSON.stringify(req))}`,
    {
      headers: {
        ...GOOGLE_TRENDS_HEADERS,
        ...(cookie ? { cookie } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    },
  );

  if (!response.ok) {
    throw new Error(`Google Trends explore HTTP ${response.status}`);
  }

  const payload = parseGoogleTrendsJson(await response.text(), 4) as {
    widgets?: GoogleTrendsWidget[];
  };

  const widget = (payload.widgets ?? []).find((item) => item.id.includes("RELATED_QUERIES"));

  if (!widget) {
    throw new Error(`Google Trends related queries widget not found for "${keyword}"`);
  }

  return widget;
}

async function fetchRankedQueries(
  widget: GoogleTrendsWidget,
  context: GoogleTrendsContext,
  cookie: string,
) {
  const response = await fetch(
    `${GOOGLE_TRENDS_BASE_URL}/api/widgetdata/relatedsearches?hl=${encodeURIComponent(context.hl)}&tz=${context.tz}&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${encodeURIComponent(widget.token)}`,
    {
      headers: {
        ...GOOGLE_TRENDS_HEADERS,
        ...(cookie ? { cookie } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    },
  );

  if (!response.ok) {
    throw new Error(`Google Trends relatedsearches HTTP ${response.status}`);
  }

  const payload = parseGoogleTrendsJson(await response.text(), 5) as {
    default?: {
      rankedList?: Array<{
        rankedKeyword?: Array<{
          query?: string;
          value?: number | string;
        }>;
      }>;
    };
  };

  const rankedLists = payload.default?.rankedList ?? [];

  return {
    top: rankedLists[0]?.rankedKeyword?.filter(hasQuery) ?? [],
    rising: rankedLists[1]?.rankedKeyword?.filter(hasQuery) ?? [],
  };
}

function parseGoogleTrendsJson(raw: string, trimChars: number) {
  return JSON.parse(raw.slice(trimChars));
}

function hasQuery(item: { query?: string }) {
  return Boolean(item.query && normalizeWhitespace(item.query).length >= 2);
}

function shouldKeepTrendCandidate(query: string, suggestion: string, normalizedSuggestion: string) {
  if (!normalizedSuggestion || normalizedSuggestion.length < 2) {
    return false;
  }

  if (!/[가-힣A-Za-z0-9]/.test(suggestion)) {
    return false;
  }

  if (/^[0-9]+$/.test(normalizedSuggestion)) {
    return false;
  }

  const normalizedQuery = normalizeKeywordLoose(query);

  if (normalizedQuery === normalizedSuggestion) {
    return false;
  }

  if (hasSuspiciousLatinTail(suggestion)) {
    return false;
  }

  return true;
}

function hasSuspiciousLatinTail(value: string) {
  const tokens = normalizeWhitespace(value).split(" ");
  const tail = tokens[tokens.length - 1] ?? "";

  return /^[a-z]{10,}$/i.test(tail);
}
