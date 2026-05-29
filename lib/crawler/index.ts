import { arcaLiveCrawler } from "@/lib/crawler/arca-live";
import { dcinsideDcbestCrawler } from "@/lib/crawler/dcinside-dcbest";
import { dcinsideDcbestLiteCrawler } from "@/lib/crawler/dcinside-dcbest-lite";
import { dcinsideCrawler } from "@/lib/crawler/dcinside";
import { dogdripCrawler } from "@/lib/crawler/dogdrip";
import { dogdripPopularCrawler } from "@/lib/crawler/dogdrip-popular";
import { dogdripUserdogCrawler } from "@/lib/crawler/dogdrip-userdog";
import { fmkoreaBest2Crawler } from "@/lib/crawler/fmkorea-best2";
import { fmkoreaCrawler } from "@/lib/crawler/fmkorea";
import { mlbparkCrawler } from "@/lib/crawler/mlbpark";
import { ruliwebAllbbsCrawler } from "@/lib/crawler/ruliweb-allbbs";
import type { SourceCrawler } from "@/lib/crawler/types";

const crawlerRegistry: Record<string, SourceCrawler> = {
  "arca-live": arcaLiveCrawler,
  dcinside: dcinsideCrawler,
  "dcinside-dcbest": dcinsideDcbestCrawler,
  "dcinside-dcbest-lite": dcinsideDcbestLiteCrawler,
  fmkorea: fmkoreaCrawler,
  "fmkorea-best2": fmkoreaBest2Crawler,
  mlbpark: mlbparkCrawler,
  dogdrip: dogdripCrawler,
  "dogdrip-popular": dogdripPopularCrawler,
  "dogdrip-userdog": dogdripUserdogCrawler,
  "ruliweb-allbbs": ruliwebAllbbsCrawler,
};

export function getCrawlerForSource(externalId: string) {
  return crawlerRegistry[externalId] ?? null;
}
