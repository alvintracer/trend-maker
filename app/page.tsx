import type { Metadata } from "next";
import Image from "next/image";

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

  const latestCommunityFeed = latestCommunityDocuments
    .slice()
    .sort((left, right) => right.crawledAt.getTime() - left.crawledAt.getTime());
  const sourceCards = MAIN_PAGE_SOURCE_IDS.map((externalId) => {
    const items = latestCommunityFeed.filter((document) => document.source.externalId === externalId);

    return {
      externalId,
      name: items[0]?.source.name ?? externalId,
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#edf7e5_0%,#f6f2e8_42%,#f8f7f2_100%)] text-slate-950">
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
        <aside className="order-2 lg:order-1">
          <PublicAdSlot
            slotKey="home_left_rail"
            enabled={adSettings.home_left_rail}
            surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/82 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur lg:sticky lg:top-6"
          />
        </aside>

        <div className="order-1 flex flex-col gap-6 lg:order-2">
          <section className="rounded-[32px] border border-black/10 bg-[linear-gradient(135deg,rgba(19,39,27,0.97),rgba(29,56,38,0.94))] px-6 py-8 text-white shadow-[0_32px_100px_rgba(22,30,20,0.18)] sm:px-8">
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
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    CommunityWikiKorea
                  </span>
                </div>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                바로 지금, 한국 커뮤니티 인기 게시글과 키워드
              </h1>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-emerald-50/82 sm:text-lg">
                메인페이지는 여러 커뮤니티의 인기 게시글 제목과 링크를 모으고, 그 제목들에서
                키워드를 추출해 보여줍니다. 상세페이지 생성 파이프라인과는 별도로 움직이는
                실시간 포털 영역입니다.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {extractedKeywords.slice(0, 10).map((keyword) => (
                  <span
                    key={keyword.text}
                    className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-50"
                  >
                    {keyword.text}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-black/10 bg-[#17241a] p-5 text-white shadow-[0_16px_60px_rgba(24,32,22,0.22)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                  Community Feed
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  실시간 커뮤니티 인기 게시글
                </h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-emerald-100">
                총 {latestCommunityFeed.length}건
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              현재 저장된 모든 메인페이지용 게시글 제목을 시간순으로 그대로 보여줍니다. 길어져도
              자르지 않고 유지합니다.
            </p>

            <div className="mt-5 grid gap-3">
              {latestCommunityFeed.length > 0 ? (
                latestCommunityFeed.map((document, index) => (
                  <a
                    key={document.id}
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-[22px] border border-white/10 bg-white/6 px-4 py-4 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-white/10 px-2 text-xs font-semibold text-emerald-100">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                            {document.source.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            수집 {formatDate(document.crawledAt)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-semibold leading-6 text-white group-hover:text-emerald-100">
                          {document.title || "제목 없음"}
                        </div>
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-5 text-sm text-slate-300">
                  아직 노출할 커뮤니티 인기 게시글이 없습니다.
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-center">
            <PublicAdSlot
              slotKey="home_top_banner"
              enabled={adSettings.home_top_banner}
              surfaceClassName="overflow-hidden rounded-[22px] border border-black/10 bg-white/90 px-3 py-3 shadow-[0_10px_32px_rgba(53,58,42,0.08)]"
            />
          </div>

          <section className="rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                  Title Keywords
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  여러 소스 제목에서 뽑은 키워드
                </h2>
              </div>
              <div className="rounded-full border border-black/10 bg-stone-50 px-4 py-2 text-sm font-medium text-slate-700">
                키워드 {extractedKeywords.length}개
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-[#e3dccf] bg-[#fffdf8] p-4">
              <p className="text-sm leading-6 text-slate-600">
                메인페이지용으로 수집한 게시글 제목만 대상으로 단순 빈도 기반 키워드를 추출했습니다.
                이 영역이 메인페이지 관리 파이프라인의 키워드 레이어입니다.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {extractedKeywords.length > 0 ? (
                extractedKeywords.map((keyword, index) => (
                  <article
                    key={keyword.text}
                    className="rounded-[24px] border border-[#ddd7ca] bg-[#fcfbf7] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-slate-950">{keyword.text}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          title hits {keyword.count} · sources {keyword.sourceCount}
                        </div>
                      </div>
                      <span className="rounded-full bg-[#e8f0df] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-900">
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

          <section className="rounded-[30px] border border-black/10 bg-white/88 p-5 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                  Source Status
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  메인페이지 수집 소스 현황
                </h2>
              </div>
              <div className="rounded-full border border-black/10 bg-stone-50 px-4 py-2 text-sm font-medium text-slate-700">
                소스 {sourceCards.length}개
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sourceCards.map((source) => (
                <article
                  key={source.externalId}
                  className="rounded-[24px] border border-[#ddd7ca] bg-[#fcfbf7] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-950">{source.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{source.externalId}</div>
                    </div>
                    <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      posts {source.items.length}
                    </span>
                  </div>
                  <div className="mt-4 text-sm text-slate-600">
                    최신 수집 {source.latestCrawledAt ? formatDate(source.latestCrawledAt) : "-"}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <PublicAdSlot slotKey="home_bottom_native" enabled={adSettings.home_bottom_native} />
        </div>

        <aside className="order-3">
          <PublicAdSlot
            slotKey="home_right_rail"
            enabled={adSettings.home_right_rail}
            surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/82 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur lg:sticky lg:top-6"
          />
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}
