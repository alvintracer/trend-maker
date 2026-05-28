import * as cheerio from "cheerio";
import { existsSync } from "node:fs";

import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput, SourceCrawler } from "@/lib/crawler/types";

const DCINSIDE_HOST = "https://gall.dcinside.com";
const DCBEST_PAGE_COUNT = 5;
const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function makeAbsoluteUrl(href: string) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  return `${DCINSIDE_HOST}${href.startsWith("/") ? href : `/${href}`}`;
}

function getDcbestPageUrls() {
  return Array.from({ length: DCBEST_PAGE_COUNT }, (_, index) => {
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

  throw new Error("DCBest browser crawl unavailable: Chrome executable not found");
}

function isValidPostLink(href: string) {
  return href.includes("/board/view/");
}

function extractDocumentsFromHtml(html: string) {
  const $ = cheerio.load(html);
  const documents: CrawledDocumentInput[] = [];
  const seenUrls = new Set<string>();

  $("tr.ub-content").each((_, row) => {
    const link = $(row).find("td.gall_tit a").first();
    const href = link.attr("href");
    const title = normalizeWhitespace(link.text());

    if (!href || !isValidPostLink(href) || !title) {
      return;
    }

    const absoluteUrl = makeAbsoluteUrl(href);

    if (seenUrls.has(absoluteUrl)) {
      return;
    }

    seenUrls.add(absoluteUrl);

    const gallery = normalizeWhitespace($(row).find("td.gall_tit .icon_imgtxt").first().text());
    const commentText = normalizeWhitespace(
      $(row).find("td.gall_tit .reply_num").first().text().replace(/[\[\]]/g, ""),
    );
    const author = normalizeWhitespace($(row).find("td.gall_writer").first().text());
    const date = normalizeWhitespace($(row).find("td.gall_date").first().text());
    const views = normalizeWhitespace($(row).find("td.gall_count").first().text());
    const recommends = normalizeWhitespace($(row).find("td.gall_recommend").first().text());
    const rowText = normalizeWhitespace($(row).text());

    const contentParts = [
      gallery ? `gallery:${gallery}` : "",
      `title:${title}`,
      commentText ? `comments:${commentText}` : "",
      author ? `author:${author}` : "",
      date ? `date:${date}` : "",
      views ? `views:${views}` : "",
      recommends ? `recommends:${recommends}` : "",
      rowText ? `row:${rowText}` : "",
    ].filter(Boolean);

    documents.push({
      url: absoluteUrl,
      title,
      content: contentParts.join("\n"),
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

    const allDocuments: CrawledDocumentInput[] = [];
    const seenUrls = new Set<string>();

    for (const pageUrl of getDcbestPageUrls()) {
      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      await page.waitForTimeout(1500);
      const html = await page.content();
      const documents = extractDocumentsFromHtml(html);

      for (const document of documents) {
        if (seenUrls.has(document.url)) {
          continue;
        }

        seenUrls.add(document.url);
        allDocuments.push(document);
      }
    }

    return {
      documents: allDocuments,
      method: "browser",
      detail: `dcbest-pages-1-${DCBEST_PAGE_COUNT}`,
    };
  } finally {
    await browser.close();
  }
}

export const dcinsideDcbestCrawler: SourceCrawler = {
  async fetchDocuments() {
    if (process.env.DISABLE_BROWSER_CRAWL !== "true") {
      try {
        return await fetchDocumentsWithBrowser();
      } catch (error) {
        if (process.env.VERCEL === "1") {
          throw error;
        }
      }
    }

    const allDocuments: CrawledDocumentInput[] = [];
    const seenUrls = new Set<string>();

    for (const pageUrl of getDcbestPageUrls()) {
      const response = await fetch(pageUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
          "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          referer: "https://gall.dcinside.com/",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        throw new Error(`DCBest fetch failed on ${pageUrl}: ${response.status}`);
      }

      const documents = extractDocumentsFromHtml(await response.text());

      for (const document of documents) {
        if (seenUrls.has(document.url)) {
          continue;
        }

        seenUrls.add(document.url);
        allDocuments.push(document);
      }
    }

    return {
      documents: allDocuments,
      method: "fetch",
      detail: `dcbest-pages-1-${DCBEST_PAGE_COUNT}`,
    };
  },
};
