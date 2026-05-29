import * as cheerio from "cheerio";

import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput, SourceCrawler } from "@/lib/crawler/types";

const DOGDRIP_HOST = "https://www.dogdrip.net";
const PAGE_COUNT = 3;

function getPageUrls() {
  return Array.from({ length: PAGE_COUNT }, (_, index) => {
    const page = index + 1;

    if (page === 1) {
      return `${DOGDRIP_HOST}/?mid=userdog&sort_index=popular`;
    }

    return `${DOGDRIP_HOST}/?mid=userdog&sort_index=popular&page=${page}`;
  });
}

function parseDogdripDocuments(html: string, pathPrefix: string) {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const items: CrawledDocumentInput[] = [];

  $("a[data-document-srl]").each((_, element) => {
    const href = $(element).attr("href");
    const rawTitle = $(element).attr("title") || $(element).text();
    const title = normalizeWhitespace(rawTitle);

    if (!href || !title || title.length < 4) {
      return;
    }

    if (!href.startsWith(pathPrefix)) {
      return;
    }

    const absoluteUrl = `${DOGDRIP_HOST}${href}`;
    const uniqueKey = `${absoluteUrl}::${title}`;

    if (seen.has(uniqueKey)) {
      return;
    }

    seen.add(uniqueKey);
    items.push({
      url: absoluteUrl,
      title,
      content: title,
    });
  });

  return items;
}

export const dogdripUserdogCrawler: SourceCrawler = {
  async fetchDocuments() {
    const allDocuments: CrawledDocumentInput[] = [];
    const seen = new Set<string>();

    for (const url of getPageUrls()) {
      const response = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
          "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        throw new Error(`Dogdrip userdog fetch failed on ${url}: ${response.status}`);
      }

      for (const document of parseDogdripDocuments(await response.text(), "/userdog/")) {
        const key = `${document.url}::${document.title}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        allDocuments.push(document);
      }
    }

    return {
      documents: allDocuments.slice(0, 120),
      method: "fetch",
      detail: "dogdrip-userdog-pages-1-3",
    };
  },
};
