import { normalizeWhitespace } from "@/lib/normalize";

type ManualKeywordEntry = {
  text: string;
  region: string;
  language: string;
};

const SECTION_CONFIG = {
  한국: {
    region: "KR",
    language: "ko",
  },
  일본: {
    region: "JP",
    language: "ja",
  },
} as const;

export function parseManualKeywordBlock(input: string): ManualKeywordEntry[] {
  const entries: ManualKeywordEntry[] = [];
  let activeRegion = "KR";
  let activeLanguage = "ko";

  for (const rawLine of input.split(/\r?\n/)) {
    const line = normalizeWhitespace(rawLine);

    if (!line) {
      continue;
    }

    const sectionMatch = line.match(/^\[(.+)\]$/);

    if (sectionMatch) {
      const sectionName = sectionMatch[1]?.trim() as keyof typeof SECTION_CONFIG | undefined;
      const config = sectionName ? SECTION_CONFIG[sectionName] : null;

      if (config) {
        activeRegion = config.region;
        activeLanguage = config.language;
      }

      continue;
    }

    entries.push({
      text: line,
      region: activeRegion,
      language: activeLanguage,
    });
  }

  return dedupeManualKeywordEntries(entries);
}

function dedupeManualKeywordEntries(entries: ManualKeywordEntry[]) {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.region}:${entry.language}:${entry.text.toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
