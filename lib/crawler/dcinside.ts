import * as cheerio from "cheerio";

import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput, SourceCrawler } from "@/lib/crawler/types";

const DCINSIDE_HOST = "https://gall.dcinside.com";

function makeAbsoluteUrl(href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  return `${DCINSIDE_HOST}${href.startsWith("/") ? href : `/${href}`}`;
}

export const dcinsideCrawler: SourceCrawler = {
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
      throw new Error(`DCInside fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const items: CrawledDocumentInput[] = [];

    $("a[href*='/board/view/']").each((_, element) => {
      const href = $(element).attr("href");
      const rawTitle = $(element).text();

      if (!href) {
        return;
      }

      const title = normalizeWhitespace(rawTitle);

      if (!title || title.length < 6) {
        return;
      }

      if (
        title.includes("갤러리") ||
        title.includes("실시간 베스트") ||
        title.includes("더보기")
      ) {
        return;
      }

      const absoluteUrl = makeAbsoluteUrl(href);
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
      detail: "list-page",
    };
  },
};
