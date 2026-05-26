import { normalizeKeyword, normalizeWhitespace } from "@/lib/normalize";
import type { PrimaryKeywordCandidate } from "@/lib/types";

const STOPWORDS = new Set([
  "ㅋㅋ",
  "ㅋㅋㅋ",
  "ㄷㄷ",
  "ㄷㄷㄷ",
  "the",
  "and",
  "with",
  "from",
  "http",
  "https",
  "www",
  "com",
  "gif",
  "jpg",
  "mp4",
  "png",
]);

function tokenize(value: string) {
  return normalizeWhitespace(value)
    .replace(/[\[\]\(\)\{\}<>\.,!?;:"'`~@#$%^&*_+=|\\/]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= 2)
    .filter((token) => /[가-힣A-Za-z0-9]/.test(token))
    .filter((token) => !/^[0-9]+$/.test(token))
    .filter((token) => !/^[0-9]{2}-[0-9]{2}$/.test(token))
    .filter((token) => !/^[0-9]{1,2}:[0-9]{2}$/.test(token))
    .filter((token) => !/^[0-9]{2}\/[0-9]{2}$/.test(token))
    .filter((token) => !STOPWORDS.has(token.toLowerCase()));
}

function toCandidateMapKey(value: string) {
  return normalizeKeyword(value);
}

export function extractPrimaryKeywordCandidates(
  inputs: Array<{ sourceId: string; text: string }>,
  limit = 30,
) {
  const frequencyMap = new Map<string, { text: string; count: number; sourceIds: Set<string> }>();

  for (const input of inputs) {
    const tokens = tokenize(input.text);
    const localSeen = new Set<string>();

    for (const token of tokens) {
      const normalizedText = toCandidateMapKey(token);
      upsertCandidate(frequencyMap, normalizedText, token, input.sourceId, localSeen);
    }

    for (let index = 0; index < tokens.length - 1; index += 1) {
      const phrase = `${tokens[index]} ${tokens[index + 1]}`;

      if (!/[가-힣A-Za-z]/.test(phrase)) {
        continue;
      }

      const normalizedText = toCandidateMapKey(phrase);
      upsertCandidate(frequencyMap, normalizedText, phrase, input.sourceId, localSeen);
    }
  }

  return [...frequencyMap.entries()]
    .map(([normalizedText, value]): PrimaryKeywordCandidate => {
      const sourceCount = value.sourceIds.size;
      const frequencyScore = value.count;
      const opportunityScore = Number((frequencyScore * 0.7 + sourceCount * 1.3).toFixed(2));

      return {
        text: value.text,
        normalizedText,
        frequencyScore,
        sourceCount,
        opportunityScore,
        sourceIds: [...value.sourceIds].sort(),
      };
    })
    .sort((left, right) => {
      if (right.opportunityScore !== left.opportunityScore) {
        return right.opportunityScore - left.opportunityScore;
      }

      if (right.sourceCount !== left.sourceCount) {
        return right.sourceCount - left.sourceCount;
      }

      return right.frequencyScore - left.frequencyScore;
    })
    .slice(0, limit);
}

function upsertCandidate(
  frequencyMap: Map<string, { text: string; count: number; sourceIds: Set<string> }>,
  normalizedText: string,
  text: string,
  sourceId: string,
  localSeen: Set<string>,
) {
  const existing = frequencyMap.get(normalizedText);

  if (existing) {
    existing.count += 1;

    if (!localSeen.has(normalizedText)) {
      existing.sourceIds.add(sourceId);
      localSeen.add(normalizedText);
    }

    return;
  }

  frequencyMap.set(normalizedText, {
    text,
    count: 1,
    sourceIds: new Set([sourceId]),
  });
  localSeen.add(normalizedText);
}
