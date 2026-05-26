import type { Metadata } from "next";
import Link from "next/link";

import { getPublishedGeneratedPages } from "@/lib/generated-page-service";
import {
  getPinnedPrimaryKeywords,
  getTopPrimaryKeywords,
  parseKeywordSourceIds,
} from "@/lib/keyword-repository";
import { getSourceStats, getSources } from "@/lib/source-repository";

export const metadata: Metadata = {
  title: "CommunityWikiKorea",
  description: "한국 커뮤니티에서 지금 뜨는 실시간 트렌드 키워드와 허브 페이지를 모아보는 위키.",
};

export default async function Home() {
  const [sources, stats, topKeywords, pinnedKeywords, publishedPages] = await Promise.all([
    getSources(),
    getSourceStats(),
    getTopPrimaryKeywords(12),
    getPinnedPrimaryKeywords(6),
    getPublishedGeneratedPages(12),
  ]);

  const liveKeywords = pinnedKeywords.length > 0 ? pinnedKeywords : topKeywords.slice(0, 8);
  const featuredPages = publishedPages.slice(0, 6);
  const sourceNameById = new Map(sources.map((source) => [source.externalId, source.name]));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f0f7e8_0%,#f5f1e8_42%,#f7f6f2_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
        <section className="rounded-[32px] border border-black/10 bg-[linear-gradient(135deg,rgba(19,39,27,0.97),rgba(29,56,38,0.94))] px-6 py-6 text-white shadow-[0_32px_100px_rgba(22,30,20,0.18)] sm:px-8 lg:px-10 lg:py-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                  CommunityWikiKorea
                </span>
                <span className="text-sm text-emerald-100/75">
                  Korean community trend wiki
                </span>
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                한국 커뮤니티에서 지금 뜨는 키워드를 바로 읽는 실시간 트렌드 위키.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50/82 sm:text-lg">
                디시인사이드, FM코리아, MLB파크, DogDrip 등 주요 커뮤니티에서 떠오르는
                키워드를 모으고, 각 주제를 허브 페이지로 연결합니다.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={featuredPages[0]?.canonicalPath ?? "/keywords"}
                  className="rounded-full bg-[#e8f3d8] px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
                >
                  지금 뜨는 허브 보기
                </Link>
                <Link
                  href="/keywords"
                  className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/12"
                >
                  전체 키워드 인벤토리
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px] lg:grid-cols-1">
              <HeroStat label="활성 소스" value={String(stats.activeCount)} detail="수집 중인 커뮤니티" />
              <HeroStat
                label="라이브 키워드"
                value={String(topKeywords.length)}
                detail="현재 상위 primary set"
              />
              <HeroStat
                label="공개 허브"
                value={String(publishedPages.length)}
                detail="도메인에서 읽을 수 있는 페이지"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                  Live Trend Board
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  지금 뜨는 키워드
                </h2>
              </div>
              <div className="text-sm text-slate-500">
                핀된 키워드 우선, 없으면 실시간 점수 기준
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {liveKeywords.map((keyword, index) => {
                const metric = keyword.metrics[0];
                const keywordSourceIds = parseKeywordSourceIds(keyword.sourceIdsRaw);

                return (
                  <article
                    key={keyword.id}
                    className="rounded-[24px] border border-black/8 bg-stone-50/80 px-4 py-4 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-semibold text-slate-950">
                              {keyword.text}
                            </h3>
                            <div className="mt-1 text-xs text-slate-500">{keyword.normalizedText}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {keywordSourceIds.length > 0 ? (
                            keywordSourceIds.map((sourceId) => (
                              <span
                                key={sourceId}
                                className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] text-slate-700"
                              >
                                {sourceNameById.get(sourceId) ?? sourceId}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 text-[11px] text-slate-700">
                              manual
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid min-w-[146px] gap-2 text-right sm:grid-cols-1">
                        <MetricPill label="Opportunity" value={metric ? metric.opportunityScore.toFixed(2) : "0.00"} />
                        <MetricPill label="Frequency" value={metric ? String(metric.frequencyScore) : "0"} />
                        <MetricPill label="Sources" value={metric ? String(metric.sourceCount) : "0"} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-[#152218] p-6 text-white shadow-[0_16px_60px_rgba(24,32,22,0.22)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
                  Source Radar
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">트렌드가 잡히는 커뮤니티</h2>
              </div>
              <Link
                href="/admin"
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
              >
                Admin
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {sources.slice(0, 6).map((source) => (
                <div
                  key={source.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold">{source.name}</div>
                      <div className="mt-1 text-sm text-emerald-100/70">{source.category}</div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-100">
                      {source.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-200/85">{source.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                Hub Pages
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                바로 들어갈 수 있는 허브
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                메인에서 키워드를 본 뒤, 아래 허브 페이지로 들어가면 요약 정보와 관련 질문,
                연관 탐색어를 이어서 볼 수 있습니다.
              </p>
            </div>
          </div>

          {featuredPages.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {featuredPages.map((page) => {
                const metric = page.keyword.metrics[0];

                return (
                  <Link
                    key={page.id}
                    href={page.canonicalPath}
                    className="group rounded-[26px] border border-black/8 bg-stone-50/85 p-5 transition-transform duration-200 hover:-translate-y-1 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="rounded-full bg-[#dce9c9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-950">
                          Live Hub
                        </div>
                        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950 group-hover:text-emerald-900">
                          {page.h1}
                        </h3>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        {formatDate(page.updatedAt)}
                      </div>
                    </div>
                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-700">
                      {page.summary || page.description}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <SmallChip>{page.keyword.text}</SmallChip>
                      <SmallChip>
                        opportunity {metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                      </SmallChip>
                      <SmallChip>{page.keyword.level}</SmallChip>
                    </div>
                    <div className="mt-5 text-sm font-semibold text-emerald-900">
                      허브 읽기
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-black/10 bg-stone-50/70 px-5 py-6 text-sm text-slate-500">
              공개된 허브 페이지가 아직 없습니다. 분석과 페이지 발행이 완료되면 이 영역에
              트렌드 허브가 자동으로 연결됩니다.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function HeroStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur">
      <div className="text-sm font-medium text-emerald-100/70">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm text-emerald-100/70">{detail}</div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function SmallChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-slate-700">
      {children}
    </span>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}
