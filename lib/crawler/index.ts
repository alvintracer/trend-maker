import { dcinsideCrawler } from "@/lib/crawler/dcinside";
import { dogdripCrawler } from "@/lib/crawler/dogdrip";
import { fmkoreaCrawler } from "@/lib/crawler/fmkorea";
import { mlbparkCrawler } from "@/lib/crawler/mlbpark";
import type { SourceCrawler } from "@/lib/crawler/types";

const crawlerRegistry: Record<string, SourceCrawler> = {
  dcinside: dcinsideCrawler,
  fmkorea: fmkoreaCrawler,
  mlbpark: mlbparkCrawler,
  dogdrip: dogdripCrawler,
};

export function getCrawlerForSource(externalId: string) {
  return crawlerRegistry[externalId] ?? null;
}
