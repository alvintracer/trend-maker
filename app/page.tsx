import type { Metadata } from "next";
import Image from "next/image";
import { Fragment } from "react";

import { GlobalAdScripts } from "@/components/ads/global-ad-scripts";
import { PublicAdSlot } from "@/components/ads/public-ad-slot";
import { getAdSlotSettingsMap } from "@/lib/ad-settings";
import { MAIN_PAGE_SOURCE_IDS } from "@/lib/main-page-sources";
import { getLatestRawDocumentsBySourceExternalIds } from "@/lib/raw-document-repository";
import { getSiteUrl } from "@/lib/site-url";

const STOPWORDS = new Set([
  "the",
  "and",
  "with",
  "from",
  "this",
  "that",
  "있음",
  "관련",
  "정리",
  "근황",
  "후기",
  "정보",
  "영상",
  "사진",
  "사람",
  "커뮤",
  "커뮤니티",
  "실시간",
  "인기",
  "게시글",
  "디시",
  "dc",
  "dcinside",
  "fmkorea",
  "dogdrip",
  "arca",
  "live",
]);

const MAX_COMMUNITY_FEED_ITEMS = 500;

export const metadata: Metadata = {
  title: "CommunityWikiKorea",
  description: "한국 커뮤니티 인기 게시글과 제목 기반 키워드를 한 화면에서 추적하는 포털.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: "CommunityWikiKorea",
    description: "한국 커뮤니티 인기 게시글과 제목 기반 키워드를 한 화면에서 추적하는 포털.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "CommunityWikiKorea",
    description: "한국 커뮤니티 인기 게시글과 제목 기반 키워드를 한 화면에서 추적하는 포털.",
  },
};

export default async function Home() {
  const [latestCommunityDocuments, adSettings] = await Promise.all([
    getLatestRawDocumentsBySourceExternalIds([...MAIN_PAGE_SOURCE_IDS], 200),
    getAdSlotSettingsMap(),
  ]);

  const latestCommunityFeed = interleaveCommunityFeed(
    MAIN_PAGE_SOURCE_IDS.map((externalId) =>
      latestCommunityDocuments
        .filter((document) => document.source.externalId === externalId)
        .sort((left, right) => right.crawledAt.getTime() - left.crawledAt.getTime()),
    ),
  ).slice(0, MAX_COMMUNITY_FEED_ITEMS);
  const sourceCards = MAIN_PAGE_SOURCE_IDS.map((externalId) => {
    const items = latestCommunityFeed.filter((document) => document.source.externalId === externalId);

    return {
      externalId,
      name: formatSourceName(items[0]?.source.name ?? externalId),
      items,
      latestCrawledAt: items[0]?.crawledAt ?? null,
    };
  });
  const extractedKeywords = extractCommunityKeywords(latestCommunityFeed).slice(0, 42);
  const siteUrl = getSiteUrl();
  const homeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "CommunityWikiKorea",
        url: siteUrl,
        inLanguage: "ko-KR",
        description: "한국 커뮤니티 인기 게시글과 제목 기반 키워드를 한 화면에서 추적하는 포털.",
      },
      {
        "@type": "CollectionPage",
        name: "실시간 커뮤니티 인기 게시글",
        url: siteUrl,
        inLanguage: "ko-KR",
        description: "디시, FMKorea, 아카라이브, Dogdrip 인기 게시글 제목과 링크를 모은 포털.",
        mainEntity: {
          "@type": "ItemList",
          itemListElement: latestCommunityFeed.slice(0, 50).map((document, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: document.title || "제목 없음",
            url: document.url,
          })),
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0eafd_0%,#f1f5f9_42%,#f8fafc_100%)] text-slate-950">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <GlobalAdScripts
        enabledKeys={[
          ...(adSettings.global_social_bar ? (["global_social_bar"] as const) : []),
          ...(adSettings.global_popunder ? (["global_popunder"] as const) : []),
        ]}
      />

      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)_220px] lg:px-6 lg:py-8">
        <aside className="hidden lg:block lg:order-1">
          <div className="sticky top-6 flex flex-col gap-6">
            <PublicAdSlot
              slotKey="home_left_rail"
              enabled={adSettings.home_left_rail}
              surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/82 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
            />
            <PublicAdSlot
              slotKey="home_inline_rectangle"
              enabled={adSettings.home_inline_rectangle}
              surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/82 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
            />
          </div>
        </aside>

        <div className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
          <section className="rounded-[32px] border border-black/10 bg-[linear-gradient(135deg,#0a192f_0%,#1e3a8a_100%)] px-6 py-8 text-white shadow-[0_32px_100px_rgba(15,23,42,0.18)] sm:px-8">
            <div className="mx-auto max-w-5xl text-center">
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-3 py-2">
                  <Image
                    src="/icon-192.png"
                    alt="CommunityWikiKorea logo"
                    width={28}
                    height={28}
                    className="rounded-lg"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                    CommunityWikiKorea
                  </span>
                </div>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                바로 지금, 한국 커뮤니티 트렌드
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-blue-100/90 sm:text-lg">
                메인페이지는 여러 커뮤니티의 인기 게시글 제목과 링크를 모으고, 그 제목들에서
                키워드를 추출해 보여줍니다. 
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {extractedKeywords.slice(0, 10).map((keyword) => (
                  <span
                    key={keyword.text}
                    className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-medium text-sky-100"
                  >
                    {keyword.text}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-black/10 bg-[#0b132b] p-5 text-white shadow-[0_16px_60px_rgba(11,19,43,0.22)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/80">
                  Community Feed
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  실시간 커뮤니티 인기 게시글
                </h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-sky-200">
                총 {latestCommunityFeed.length}건
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              지금 한국의 메이저 커뮤니티에서 인기있는 게시글의 제목과 링크를 모아 보여줍니다. 제목을 클릭하면 해당 게시물로 이동합니다.
            </p>

            <div className="mt-5 grid gap-3">
              {latestCommunityFeed.length > 0 ? (
                latestCommunityFeed.map((document, index) => (
                  <Fragment key={document.id}>
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-[18px] border border-white/10 bg-white/6 px-4 py-3 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <span className="shrink-0 mt-0.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-white/10 px-2 text-xs font-semibold text-sky-200 sm:mt-0">
                          {index + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <div className="shrink-0">
                            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-200">
                              {formatSourceName(document.source.name)}
                            </span>
                          </div>
                          <div className="min-w-0 break-words text-sm font-semibold leading-relaxed text-white group-hover:text-sky-300">
                            {document.title || "제목 없음"}
                          </div>
                        </div>
                      </div>
                    </a>
                    {(index + 1) % 20 === 0 && index !== latestCommunityFeed.length - 1 && (
                      <div className="my-2 flex w-full max-w-full justify-center overflow-hidden">
                        <PublicAdSlot
                          slotKey="home_top_banner"
                          enabled={adSettings.home_top_banner}
                          className="w-full max-w-full"
                          surfaceClassName="overflow-hidden rounded-[22px] border border-black/10 bg-white/90 px-3 py-3 shadow-[0_10px_32px_rgba(53,58,42,0.08)]"
                        />
                      </div>
                    )}
                  </Fragment>
                ))
              ) : (
                <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-5 text-sm text-slate-300">
                  아직 노출할 커뮤니티 인기 게시글이 없습니다.
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-center w-full max-w-full overflow-hidden">
            <PublicAdSlot
              slotKey="home_top_banner"
              enabled={adSettings.home_top_banner}
              className="w-full max-w-full"
              surfaceClassName="overflow-hidden rounded-[22px] border border-black/10 bg-white/90 px-3 py-3 shadow-[0_10px_32px_rgba(53,58,42,0.08)]"
            />
          </div>

          <section className="rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_16px_60px_rgba(30,41,59,0.06)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-900">
                  Title Keywords
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  지금 인기있는 키워드
                </h2>
              </div>
              <div className="rounded-full border border-black/10 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                키워드 {extractedKeywords.length}개
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {extractedKeywords.length > 0 ? (
                extractedKeywords.map((keyword, index) => (
                  <article
                    key={keyword.text}
                    className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-slate-950 break-words">{keyword.text}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          title hits {keyword.count} · sources {keyword.sourceCount}
                        </div>
                      </div>
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-900">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {keyword.sources.map((source) => (
                        <span
                          key={`${keyword.text}-${source}`}
                          className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-black/10 bg-stone-50/70 px-4 py-6 text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                  제목 기반 키워드를 추출할 데이터가 아직 없습니다.
                </div>
              )}
            </div>
          </section>

          <PublicAdSlot slotKey="home_bottom_native" enabled={adSettings.home_bottom_native} />
        </div>

        <aside className="hidden lg:block lg:order-3">
          <div className="sticky top-6 flex flex-col gap-6">
            <PublicAdSlot
              slotKey="home_right_rail"
              enabled={adSettings.home_right_rail}
              surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/82 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
            />
            <PublicAdSlot
              slotKey="home_inline_rectangle"
              enabled={adSettings.home_inline_rectangle}
              surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/82 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

function extractCommunityKeywords(
  documents: Array<{
    title: string | null;
    source: {
      name: string;
    };
  }>,
) {
  const keywordMap = new Map<
    string,
    {
      text: string;
      count: number;
      sources: Set<string>;
    }
  >();

  for (const document of documents) {
    const title = (document.title ?? "").trim();

    if (!title) {
      continue;
    }

    const tokens = new Set(
      title
        .split(/[^0-9A-Za-z가-힣]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && token.length <= 20)
        .filter((token) => !/^\d+$/.test(token))
        .filter((token) => !STOPWORDS.has(token.toLowerCase())),
    );

    for (const token of tokens) {
      const normalized = token.toLowerCase();
      const existing = keywordMap.get(normalized);

      if (existing) {
        existing.count += 1;
        existing.sources.add(document.source.name);
        continue;
      }

      keywordMap.set(normalized, {
        text: token,
        count: 1,
        sources: new Set([document.source.name]),
      });
    }
  }

  return Array.from(keywordMap.values())
    .map((keyword) => ({
      text: keyword.text,
      count: keyword.count,
      sourceCount: keyword.sources.size,
      sources: [...keyword.sources].sort(),
    }))
    .sort((left, right) => {
      if (right.sourceCount !== left.sourceCount) {
        return right.sourceCount - left.sourceCount;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.text.localeCompare(right.text, "ko");
    });
}

function interleaveCommunityFeed<
  T extends {
    id: number;
  },
>(groups: T[][]) {
  const queues = groups.map((group) => [...group]);
  const merged: T[] = [];

  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const item = queue.shift();

      if (item) {
        merged.push(item);
      }
    }
  }

  return merged;
}

function formatSourceName(value: string) {
  return value
    .replace(/\s+Popular$/i, "")
    .replace(/\s+Userdog$/i, "")
    .replace(/\s+Lite$/i, "")
    .trim();
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}
