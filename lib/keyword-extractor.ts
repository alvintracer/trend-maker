import { normalizeKeyword, normalizeWhitespace } from "@/lib/normalize";
import type { PrimaryKeywordCandidate } from "@/lib/types";

const STOPWORDS = new Set([
  // Korean internet slang
  "ㅋㅋ", "ㅋㅋㅋ", "ㄷㄷ", "ㄷㄷㄷ", "ㅎㅎ", "ㅎㅎㅎ", "ㄱㄱ",
  // English common
  "the", "and", "with", "from", "this", "that", "for", "are", "but", "not",
  "you", "all", "can", "had", "her", "was", "one", "our", "out",
  // File/URL fragments
  "http", "https", "www", "com", "gif", "jpg", "mp4", "png", "org", "net",
  // Generic Korean nouns (too broad as single keywords)
  "한국", "일본", "미국", "중국", "영국", "독일", "러시아", "프랑스",
  "세계", "나라", "국가", "지역", "도시", "사회", "문화", "역사",
  "요즘", "최근", "현재", "오늘", "어제", "내일", "지금", "올해", "작년",
  "시절", "당시", "이후", "이전", "동안", "사이", "때문",
  "사람", "사람들", "여자", "남자", "아이", "학생", "선생",
  "정도", "이상", "이하", "정말", "진짜", "완전", "엄청", "되게",
  "느낌", "생각", "의견", "반응", "상황", "결과", "내용", "부분",
  "사건", "사고", "문제", "논란", "수준", "상태", "방법", "이유",
  "경우", "모습", "모양", "종류", "방향", "위치", "장소",
  "있음", "없음", "관련", "정리", "근황", "후기", "정보",
  "영상", "사진", "이미지", "글", "댓글", "제목", "본문",
  "단독", "속보", "긴급", "특보", "종합",
  "사망", "신고", "발생", "발견", "확인", "공개", "발표",
  "누구", "어디", "언제", "무엇", "어떻게",
  // Community site names
  "커뮤", "커뮤니티", "실시간", "인기", "게시글", "갤러리",
  "디시", "에펨", "독드립", "아카", "루리", "나무위키",
  "dc", "dcinside", "fmkorea", "dogdrip", "arca", "live",
  "mlbpark", "theqoo", "instiz", "ppomppu", "clien",
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
  inputs: Array<{ sourceId: string; text: string; weight?: number }>,
  limit = 30,
) {
  const frequencyMap = new Map<string, { text: string; count: number; weightedScore: number; sourceIds: Set<string> }>();

  for (const input of inputs) {
    const tokens = tokenize(input.text);
    const localSeen = new Set<string>();

    for (const token of tokens) {
      const normalizedText = toCandidateMapKey(token);
      upsertCandidate(frequencyMap, normalizedText, token, input.sourceId, localSeen, input.weight ?? 1.0);
    }

    for (let index = 0; index < tokens.length - 1; index += 1) {
      const phrase = `${tokens[index]} ${tokens[index + 1]}`;

      if (!/[가-힣A-Za-z]/.test(phrase)) {
        continue;
      }

      const normalizedText = toCandidateMapKey(phrase);
      upsertCandidate(frequencyMap, normalizedText, phrase, input.sourceId, localSeen, input.weight ?? 1.0);
    }
  }

  return [...frequencyMap.entries()]
    .map(([normalizedText, value]): PrimaryKeywordCandidate => {
      const sourceCount = value.sourceIds.size;
      const frequencyScore = value.count;
      const weightedScore = value.weightedScore;
      const isBigram = value.text.includes(" ");

      // Bigrams get a 1.8x scoring boost since they're more specific
      const bigramMultiplier = isBigram ? 1.8 : 1.0;
      const opportunityScore = Number(
        ((weightedScore * 0.7 + sourceCount * 1.3) * bigramMultiplier).toFixed(2),
      );

      return {
        text: value.text,
        normalizedText,
        frequencyScore,
        sourceCount,
        opportunityScore,
        sourceIds: [...value.sourceIds].sort(),
      };
    })
    // Filter out single words that appear in only 1 source (too noisy)
    .filter((candidate) => {
      const isBigram = candidate.text.includes(" ");
      if (!isBigram && candidate.sourceCount < 2) {
        return false;
      }
      return true;
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
  frequencyMap: Map<string, { text: string; count: number; weightedScore: number; sourceIds: Set<string> }>,
  normalizedText: string,
  text: string,
  sourceId: string,
  localSeen: Set<string>,
  weight: number,
) {
  const existing = frequencyMap.get(normalizedText);

  if (existing) {
    existing.count += 1;
    existing.weightedScore += weight;

    if (!localSeen.has(normalizedText)) {
      existing.sourceIds.add(sourceId);
      localSeen.add(normalizedText);
    }

    return;
  }

  frequencyMap.set(normalizedText, {
    text,
    count: 1,
    weightedScore: weight,
    sourceIds: new Set([sourceId]),
  });
  localSeen.add(normalizedText);
}
