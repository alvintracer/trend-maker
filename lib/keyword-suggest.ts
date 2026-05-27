import {
  normalizeKeyword,
  normalizeKeywordLoose,
  normalizeWhitespace,
} from "@/lib/normalize";
import type { SecondaryKeywordCandidate } from "@/lib/types";

const REQUEST_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
};

function isLowQualitySuggestion(value: string) {
  if (!value || value.length < 2) {
    return true;
  }

  if (!/[가-힣A-Za-z0-9]/.test(value)) {
    return true;
  }

  if (/^[0-9]+$/.test(value)) {
    return true;
  }

  return false;
}

function isRedundantSuggestion(query: string, suggestion: string) {
  const normalizedQuery = normalizeKeywordLoose(query);
  const normalizedSuggestion = normalizeKeywordLoose(suggestion);

  if (!normalizedQuery || !normalizedSuggestion) {
    return true;
  }

  if (normalizedQuery === normalizedSuggestion) {
    return true;
  }

  const suffix = normalizedSuggestion.replace(normalizedQuery, "").trim();

  if (!suffix) {
    return true;
  }

  if (/^[0-9]+$/.test(suffix)) {
    return true;
  }

  return false;
}

export async function fetchGoogleSuggestCandidates(
  parentKeywordId: number,
  query: string,
) {
  const suggestions = await fetchSuggestTexts(query);
  const deduped = new Set<string>();
  const candidates: SecondaryKeywordCandidate[] = [];

  suggestions.forEach((suggestion, index) => {
    const text = normalizeWhitespace(suggestion);
    const normalizedText = normalizeKeywordLoose(text);

    if (
      isLowQualitySuggestion(text) ||
      isRedundantSuggestion(query, text) ||
      deduped.has(normalizedText)
    ) {
      return;
    }

    deduped.add(normalizedText);
    candidates.push({
      parentKeywordId,
      query,
      text,
      normalizedText: normalizeKeyword(normalizedText),
      rank: index + 1,
      provider: "google_suggest",
    });
  });

  return candidates;
}

async function fetchSuggestTexts(query: string) {
  const jsonUrl = `https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&q=${encodeURIComponent(
    query,
  )}`;

  try {
    const rawText = await fetchSuggestResponse(jsonUrl);
    const payload = JSON.parse(rawText) as [string, string[]];
    const suggestions = Array.isArray(payload?.[1]) ? payload[1] : [];

    if (suggestions.length > 0) {
      return suggestions;
    }
  } catch (error) {
    const xmlUrl = `https://suggestqueries.google.com/complete/search?output=toolbar&hl=ko&q=${encodeURIComponent(
      query,
    )}`;

    try {
      const rawXml = await fetchSuggestResponse(xmlUrl);
      const xmlSuggestions = parseToolbarSuggestions(rawXml);

      if (xmlSuggestions.length > 0) {
        return xmlSuggestions;
      }

      throw new Error(`Empty XML suggestions for "${query}"`);
    } catch (xmlError) {
      const primaryMessage =
        error instanceof Error ? error.message : "Unknown JSON suggest error";
      const fallbackMessage =
        xmlError instanceof Error ? xmlError.message : "Unknown XML suggest error";

      throw new Error(
        `Suggest fetch failed for "${query}". JSON: ${primaryMessage} | XML: ${fallbackMessage}`,
      );
    }
  }

  return [];
}

async function fetchSuggestResponse(url: string) {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function parseToolbarSuggestions(rawXml: string) {
  const matches = rawXml.matchAll(/<suggestion\s+data="([^"]+)"/g);
  return [...matches].map((match) => normalizeWhitespace(decodeXmlEntities(match[1] ?? "")));
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}
