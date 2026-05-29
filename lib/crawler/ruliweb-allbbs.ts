import * as cheerio from "cheerio";

import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput, SourceCrawler } from "@/lib/crawler/types";

const RULIWEB_HOST = "https://bbs.ruliweb.com";

function toAbsoluteUrl(href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  return `${RULIWEB_HOST}${href.startsWith("/") ? href : `/${href}`}`;
}

export const ruliwebAllbbsCrawler: SourceCrawler = {
  async fetchDocuments(url) {
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
      throw new Error(`Ruliweb allbbs fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const items: CrawledDocumentInput[] = [];
    const seen = new Set<string>();

    $("a[href*='/read/'], a[href*='/market/board/read'], a[href*='/family/']").each((_, element) => {
      const href = $(element).attr("href");
      const title = normalizeWhitespace($(element).text());

      if (!href || !title || title.length < 4) {
        return;
      }

      if (!href.includes("/read/")) {
        return;
      }

      const absoluteUrl = toAbsoluteUrl(href);
      const key = `${absoluteUrl}::${title}`;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      items.push({
        url: absoluteUrl,
        title,
        content: title,
      });
    });

    return {
      documents: items.slice(0, 80),
      method: "fetch",
      detail: "allbbs-read-links",
    };
  },
};
