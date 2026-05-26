import {
  normalizeKeyword,
  normalizeKeywordLoose,
  normalizeWhitespace,
} from "@/lib/normalize";
import type { SecondaryKeywordCandidate } from "@/lib/types";

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
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&hl=ko&q=${encodeURIComponent(
    query,
  )}`;
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Suggest fetch failed: ${response.status}`);
  }

  const payload = (await response.json()) as [string, string[]];
  const suggestions = Array.isArray(payload?.[1]) ? payload[1] : [];
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
