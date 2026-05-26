import * as cheerio from "cheerio";

import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput, SourceCrawler } from "@/lib/crawler/types";

const DOGDRIP_HOST = "https://www.dogdrip.net";

export const dogdripCrawler: SourceCrawler = {
  async fetchDocuments(url) {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Dogdrip fetch failed: ${response.status}`);
    }

    const html = await response.text();
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

      if (!href.startsWith("/dogdrip/")) {
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

    return {
      documents: items.slice(0, 30),
      method: "fetch",
      detail: "popular-widget",
    };
  },
};
