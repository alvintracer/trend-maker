import * as cheerio from "cheerio";
import { existsSync } from "node:fs";

import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput } from "@/lib/crawler/types";

const FMKOREA_HOST = "https://www.fmkorea.com";
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function makeAbsoluteUrl(href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  return `${FMKOREA_HOST}${href.startsWith("/") ? href : `/${href}`}`;
}

function getChromeExecutablePath() {
  const configuredPath = process.env.FMKOREA_CHROME_EXECUTABLE;

  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  if (existsSync(DEFAULT_CHROME_PATH)) {
    return DEFAULT_CHROME_PATH;
  }

  throw new Error("FMKorea browser fallback unavailable: Chrome executable not found");
}

export async function fetchFmkoreaDocumentsWithBrowser(urls: string[]) {
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
      referer: "https://www.fmkorea.com/",
    });

    for (const url of urls) {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });

      await page.waitForTimeout(1500);
      const html = await page.content();
      const documents = parseFmkoreaDocuments(html);

      if (documents.length > 0) {
        return {
          documents,
          method: "browser",
          detail: url,
        };
      }
    }

    throw new Error("FMKorea browser fallback failed: no documents found");
  } finally {
    await browser.close();
  }
}

export function parseFmkoreaDocuments(html: string) {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const items: CrawledDocumentInput[] = [];

  $("h3.title a").each((_, element) => {
    const href = $(element).attr("href");
    const rawTitle = $(element).find(".ellipsis-target").text() || $(element).text();

    if (!href) {
      return;
    }

    if (!href.includes("/best/") && !href.includes("document_srl=")) {
      return;
    }

    const title = normalizeWhitespace(rawTitle);

    if (!title || title.length < 4) {
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

  return items.slice(0, 40);
}
