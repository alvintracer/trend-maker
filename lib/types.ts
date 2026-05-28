export type SourceKind = "community" | "forum" | "aggregation";

export type SourceStatus = "active" | "review";

export type SourceConfig = {
  id: string;
  name: string;
  url: string;
  kind: SourceKind;
  category: string;
  region: string;
  language: string;
  crawlIntervalHours: number;
  trustScore: number;
  status: SourceStatus;
  notes: string;
};

export type PipelineStage = {
  id: string;
  name: string;
  state: "ready" | "next";
  summary: string;
  output: string;
};

export type PrimaryKeywordCandidate = {
  text: string;
  normalizedText: string;
  frequencyScore: number;
  sourceCount: number;
  opportunityScore: number;
  sourceIds: string[];
};

export type SecondaryKeywordCandidate = {
  parentKeywordId: number;
  query: string;
  text: string;
  normalizedText: string;
  rank: number;
  provider:
    | "google_suggest"
    | "google_trends_top"
    | "google_trends_rising";
};
