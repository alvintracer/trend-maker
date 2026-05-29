import * as cheerio from "cheerio";
import { existsSync } from "node:fs";

import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput, SourceCrawler } from "@/lib/crawler/types";

const ARCA_HOST = "https://arca.live";
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function toAbsoluteUrl(href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  return `${ARCA_HOST}${href.startsWith("/") ? href : `/${href}`}`;
}

function getChromeExecutablePath() {
  const configuredPath = process.env.ARCA_CHROME_EXECUTABLE;

  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  if (existsSync(DEFAULT_CHROME_PATH)) {
    return DEFAULT_CHROME_PATH;
  }

  throw new Error("Arca Live browser fallback unavailable: Chrome executable not found");
}

function parseArcaDocuments(html: string) {
  const $ = cheerio.load(html);
  const items: CrawledDocumentInput[] = [];
  const seen = new Set<string>();

  $("a[href*='/b/']").each((_, element) => {
    const href = $(element).attr("href");
    const title = normalizeWhitespace($(element).text());

    if (!href || !title || title.length < 4) {
      return;
    }

    if (!/\/b\/[^/]+\/\d+/.test(href)) {
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

  return items.slice(0, 60);
}

async function fetchArcaDocumentsWithBrowser(url: string) {
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
      referer: ARCA_HOST,
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await page.waitForTimeout(1500);

    const documents = parseArcaDocuments(await page.content());

    if (documents.length === 0) {
      throw new Error("Arca Live browser fallback failed: no documents found");
    }

    return {
      documents,
      method: "browser",
      detail: "frontpage-b-links-browser",
    };
  } finally {
    await browser.close();
  }
}

export const arcaLiveCrawler: SourceCrawler = {
  async fetchDocuments(url) {
    try {
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
        throw new Error(`Arca Live fetch failed: ${response.status}`);
      }

      const documents = parseArcaDocuments(await response.text());

      if (documents.length > 0) {
        return {
          documents,
          method: "fetch",
          detail: "frontpage-b-links",
        };
      }
    } catch (error) {
      if (process.env.DISABLE_BROWSER_CRAWL === "true" || process.env.VERCEL === "1") {
        throw error;
      }
    }

    return fetchArcaDocumentsWithBrowser(url);
  },
};
