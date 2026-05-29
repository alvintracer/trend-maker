import type { Metadata } from "next";
import Link from "next/link";

import { GlobalAdScripts } from "@/components/ads/global-ad-scripts";
import { PublicAdSlot } from "@/components/ads/public-ad-slot";
import { getAdSlotSettingsMap } from "@/lib/ad-settings";
import { getPublishedGeneratedPages } from "@/lib/generated-page-service";
import {
  getPinnedPrimaryKeywords,
  getTopPrimaryKeywords,
} from "@/lib/keyword-repository";

export const metadata: Metadata = {
  title: "CommunityWikiKorea",
  description: "한국 커뮤니티에서 지금 뜨는 실시간 트렌드 키워드와 허브 페이지를 모아보는 위키.",
};

export default async function Home() {
  const [topKeywords, pinnedKeywords, publishedPages, adSettings] = await Promise.all([
    getTopPrimaryKeywords(12),
    getPinnedPrimaryKeywords(6),
    getPublishedGeneratedPages(12),
    getAdSlotSettingsMap(),
  ]);

  const liveKeywords = pinnedKeywords.length > 0 ? pinnedKeywords : topKeywords.slice(0, 10);
  const featuredPages = publishedPages.slice(0, 6);
  const publishedPageByKeywordId = new Map(
    publishedPages.map((page) => [page.keywordId, page]),
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f0f7e8_0%,#f5f1e8_42%,#f7f6f2_100%)] text-slate-950">
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
            <div className="mx-auto max-w-4xl text-center">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                CommunityWikiKorea
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                지금 한국 커뮤니티에서 가장 많이 올라오는 키워드
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-emerald-50/82 sm:text-lg">
                설명보다 흐름을 먼저 보여줍니다. 아래 보드에서 지금 뜨는 키워드를 보고,
                연결된 허브가 있으면 바로 이동할 수 있습니다.
              </p>
            </div>
          </section>

          <div className="flex justify-center">
            <PublicAdSlot
              slotKey="home_top_banner"
              enabled={adSettings.home_top_banner}
              surfaceClassName="overflow-hidden rounded-[22px] border border-black/10 bg-white/90 px-3 py-3 shadow-[0_10px_32px_rgba(53,58,42,0.08)]"
            />
          </div>

          <section className="rounded-[30px] border border-black/10 bg-white/88 p-5 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                  Trend Cluster
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  키워드 클러스터 맵
                </h2>
              </div>
              <Link
                href="/admin/keywords"
                className="rounded-full border border-black/10 bg-stone-50 px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-white"
              >
                Admin Keywords
              </Link>
            </div>

            <div className="mt-6 rounded-[28px] border border-[#d8d4c7] bg-[linear-gradient(180deg,#fbfaf6_0%,#f4f0e5_100%)] p-4 sm:p-5">
              <div className="rounded-[22px] border border-[#d7e2cc] bg-[radial-gradient(circle_at_center,#edf6dd_0%,#f8f4ea_62%,#fcfbf7_100%)] p-5">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="flex flex-wrap justify-center gap-3">
                    {liveKeywords.map((keyword, index) => {
                      const metric = keyword.metrics[0];
                      const sizeClass =
                        index === 0
                          ? "text-3xl sm:text-4xl"
                          : index < 3
                            ? "text-2xl sm:text-3xl"
                            : index < 6
                              ? "text-xl sm:text-2xl"
                              : "text-lg sm:text-xl";

                      return (
                        <div
                          key={keyword.id}
                          className={`rounded-full border border-emerald-950/10 px-4 py-2 font-semibold tracking-tight text-slate-950 shadow-[0_10px_30px_rgba(40,52,32,0.08)] ${sizeClass} ${
                            index % 4 === 0
                              ? "bg-[#dfeccc]"
                              : index % 4 === 1
                                ? "bg-[#f2e7c8]"
                                : index % 4 === 2
                                  ? "bg-[#e7efe8]"
                                  : "bg-[#f4efe3]"
                          }`}
                        >
                          {keyword.text}
                          <span className="ml-2 text-xs font-medium text-slate-500">
                            {metric ? metric.frequencyScore : 0}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <PublicAdSlot
                    slotKey="home_inline_rectangle"
                    enabled={adSettings.home_inline_rectangle}
                    surfaceClassName="overflow-hidden rounded-[22px] border border-black/10 bg-white/80 p-3"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[30px] border border-black/10 bg-white/92 p-5 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                Realtime Board
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                실시간 순위
              </h2>
              <div className="mt-5 overflow-hidden rounded-[24px] border border-[#d7d2c6]">
                <div className="grid grid-cols-[72px_minmax(0,1fr)_92px] bg-[#ebe5d6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <div>Rank</div>
                  <div>Keyword</div>
                  <div className="text-right">Hub</div>
                </div>
                {liveKeywords.map((keyword, index) => {
                  const metric = keyword.metrics[0];
                  const relatedPage = publishedPageByKeywordId.get(keyword.id) ?? null;

                  return (
                    <article
                      key={keyword.id}
                      className="grid grid-cols-[72px_minmax(0,1fr)_92px] items-center border-t border-[#ebe5d9] bg-[#fdfcf8] px-4 py-4"
                    >
                      <div className="text-center">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold text-slate-950">
                          {keyword.text}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          score {metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                        </div>
                      </div>
                      <div className="text-right">
                        {relatedPage ? (
                          <Link
                            href={relatedPage.canonicalPath}
                            className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-stone-100"
                          >
                            허브 보기
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">준비중</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-black/10 bg-[#17241a] p-5 text-white shadow-[0_16px_60px_rgba(24,32,22,0.22)] sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                    Hot Hubs
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">바로 읽는 허브</h2>
                </div>
              </div>

              {featuredPages.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  {featuredPages.map((page) => (
                    <Link
                      key={page.id}
                      href={page.canonicalPath}
                      className="group rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white group-hover:text-emerald-100">
                            {page.h1}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
                            {page.summary || page.description}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-100">
                          hub
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 px-5 py-6 text-sm text-slate-300">
                  공개 허브가 아직 없으면 메인에서는 키워드 흐름만 먼저 보여줍니다.
                </div>
              )}
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
