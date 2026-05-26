import { fetchFmkoreaDocumentsWithBrowser, parseFmkoreaDocuments } from "@/lib/crawler/fmkorea-browser";
import type { SourceCrawler } from "@/lib/crawler/types";

const FALLBACK_URLS = [
  "https://www.fmkorea.com/best",
  "https://www.fmkorea.com/index.php?mid=best",
  "https://www.fmkorea.com/",
];

export const fmkoreaCrawler: SourceCrawler = {
  async fetchDocuments(url) {
    const candidateUrls = [url, ...FALLBACK_URLS].filter(
      (candidateUrl, index, array) => array.indexOf(candidateUrl) === index,
    );
    let html = "";
    let lastError: Error | null = null;

    for (const candidateUrl of candidateUrls) {
      try {
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
        });

        if (!response.ok) {
          lastError = new Error(`FMKorea fetch failed: ${response.status} at ${candidateUrl}`);
          continue;
        }

        html = await response.text();

        if (html.includes("hotdeal_var8") || html.includes('h3 class="title"')) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown FMKorea fetch error");
      }
    }

    if (!html) {
      if (process.env.DISABLE_BROWSER_CRAWL === "true" || process.env.VERCEL === "1") {
        if (lastError) {
          throw new Error(`${lastError.message}; browser fallback disabled in this environment`);
        }

        throw new Error("FMKorea fetch failed and browser fallback is disabled");
      }

      try {
        return await fetchFmkoreaDocumentsWithBrowser(candidateUrls);
      } catch (browserError) {
        if (lastError) {
          throw new Error(
            `${lastError.message}; browser fallback failed: ${
              browserError instanceof Error ? browserError.message : "unknown browser error"
            }`,
          );
        }

        throw browserError;
      }
    }

    return {
      documents: parseFmkoreaDocuments(html),
      method: "fetch",
      detail: candidateUrls.find((candidateUrl) => html.includes(candidateUrl.replaceAll("&", "&amp;"))) ?? "fallback-chain",
    };
  },
};
