import { fetchFmkoreaDocumentsWithBrowser, parseFmkoreaDocuments } from "@/lib/crawler/fmkorea-browser";
import type { CrawledDocumentInput, SourceCrawler } from "@/lib/crawler/types";

const PAGE_COUNT = 5;

function getBest2Urls(baseUrl: string) {
  return Array.from({ length: PAGE_COUNT }, (_, index) => {
    const page = index + 1;
    const url = new URL(baseUrl);
    url.searchParams.set("mid", "best2");
    url.searchParams.set("page", String(page));
    return url.toString();
  });
}

function dedupeDocuments(documents: CrawledDocumentInput[]) {
  const seen = new Set<string>();
  const deduped: CrawledDocumentInput[] = [];

  for (const document of documents) {
    const key = `${document.url}::${document.title}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(document);
  }

  return deduped;
}

export const fmkoreaBest2Crawler: SourceCrawler = {
  async fetchDocuments(url) {
    const candidateUrls = getBest2Urls(url);
    try {
      const allDocuments: CrawledDocumentInput[] = [];

      for (const candidateUrl of candidateUrls) {
        const response = await fetch(candidateUrl, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            referer: "https://www.fmkorea.com/",
            origin: "https://www.fmkorea.com",
            "cache-control": "no-cache",
            pragma: "no-cache",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });

        if (!response.ok) {
          throw new Error(`FMKorea Best2 fetch failed: ${response.status} at ${candidateUrl}`);
        }

        const html = await response.text();
        allDocuments.push(...parseFmkoreaDocuments(html));
      }

      const deduped = dedupeDocuments(allDocuments);

      if (deduped.length > 0) {
        return {
          documents: deduped.slice(0, 120),
          method: "fetch",
          detail: "best2-pages-1-5",
        };
      }
    } catch (error) {
      if (process.env.DISABLE_BROWSER_CRAWL === "true" || process.env.VERCEL === "1") {
        throw error;
      }
    }

    return fetchFmkoreaDocumentsWithBrowser(candidateUrls);
  },
};
