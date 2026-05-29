import * as cheerio from "cheerio";
import { existsSync } from "node:fs";

import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput, SourceCrawler } from "@/lib/crawler/types";

const DCINSIDE_HOST = "https://gall.dcinside.com";
const PAGE_COUNT = 5;
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function makeAbsoluteUrl(href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  return `${DCINSIDE_HOST}${href.startsWith("/") ? href : `/${href}`}`;
}

function getPageUrls() {
  return Array.from({ length: PAGE_COUNT }, (_, index) => {
    const page = index + 1;

    if (page === 1) {
      return "https://gall.dcinside.com/board/lists?id=dcbest";
    }

    return `https://gall.dcinside.com/board/lists/?id=dcbest&page=${page}&_dcbest=9`;
  });
}

function getChromeExecutablePath() {
  const configuredPath = process.env.DCINSIDE_CHROME_EXECUTABLE;

  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  if (existsSync(DEFAULT_CHROME_PATH)) {
    return DEFAULT_CHROME_PATH;
  }

  throw new Error("DCBest lite browser crawl unavailable: Chrome executable not found");
}

function extractDocumentsFromHtml(html: string) {
  const $ = cheerio.load(html);
  const documents: CrawledDocumentInput[] = [];
  const seen = new Set<string>();

  $("tr.ub-content").each((_, row) => {
    const link = $(row).find("td.gall_tit a").first();
    const href = link.attr("href");
    const title = normalizeWhitespace(link.text());

    if (!href || !title || !href.includes("/board/view/")) {
      return;
    }

    const absoluteUrl = makeAbsoluteUrl(href);
    const key = `${absoluteUrl}::${title}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    documents.push({
      url: absoluteUrl,
      title,
      content: title,
    });
  });

  return documents;
}

async function fetchDocumentsWithBrowser() {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath: getChromeExecutablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      locale: "ko-KR",
    });

    await page.setExtraHTTPHeaders({
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      referer: "https://gall.dcinside.com/",
    });

    const documents: CrawledDocumentInput[] = [];
    const seen = new Set<string>();

    for (const url of getPageUrls()) {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      await page.waitForTimeout(1200);

      for (const document of extractDocumentsFromHtml(await page.content())) {
        const key = `${document.url}::${document.title}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        documents.push(document);
      }
    }

    if (documents.length === 0) {
      throw new Error("DCBest lite browser fallback failed: no documents found");
    }

    return {
      documents: documents.slice(0, 100),
      method: "browser",
      detail: "dcbest-lite-pages-1-5",
    };
  } finally {
    await browser.close();
  }
}

export const dcinsideDcbestLiteCrawler: SourceCrawler = {
  async fetchDocuments() {
    try {
      const documents: CrawledDocumentInput[] = [];
      const seen = new Set<string>();

      for (const url of getPageUrls()) {
        const response = await fetch(url, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            referer: "https://gall.dcinside.com/",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          throw new Error(`DCBest lite fetch failed on ${url}: ${response.status}`);
        }

        for (const document of extractDocumentsFromHtml(await response.text())) {
          const key = `${document.url}::${document.title}`;
          if (seen.has(key)) {
            continue;
          }

          seen.add(key);
          documents.push(document);
        }
      }

      if (documents.length > 0) {
        return {
          documents: documents.slice(0, 100),
          method: "fetch",
          detail: "dcbest-lite-pages-1-5",
        };
      }
    } catch (error) {
      if (process.env.DISABLE_BROWSER_CRAWL === "true" || process.env.VERCEL === "1") {
        throw error;
      }
    }

    return fetchDocumentsWithBrowser();
  },
};
