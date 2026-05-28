import type { Metadata } from "next";
import Link from "next/link";

import { ingestDcbestAction } from "@/app/admin/ingest-actions";
import { updateAdSlotEnabledAction } from "@/app/admin/ad-actions";
import { PipelinePanel } from "@/components/admin/pipeline-panel";
import {
  bulkImportManualPrimaryKeywordsAction,
  createManualPrimaryKeywordAction,
  deleteManualPrimaryKeywordAction,
  updateKeywordPinnedAction,
} from "@/app/keywords/actions";
import { getAdSlotSettingsMap } from "@/lib/ad-settings";
import { adSlotDefinitions } from "@/lib/adsterra";
import { getLatestPipelineRun } from "@/lib/pipeline-run";
import {
  getPinnedPrimaryKeywords,
  getTopPrimaryKeywords,
  parseKeywordSourceIds,
} from "@/lib/keyword-repository";

export const metadata: Metadata = {
  title: "Admin",
  description: "CommunityWikiKorea 운영 대시보드",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const [keywords, pinnedKeywords, adSettings, latestPipelineRun] = await Promise.all([
    getTopPrimaryKeywords(),
    getPinnedPrimaryKeywords(8),
    getAdSlotSettingsMap(),
    getLatestPipelineRun(),
  ]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f5e9_0%,#f5f1e8_45%,#f8f7f2_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10">
        <section className="rounded-[28px] border border-black/10 bg-white/85 p-8 shadow-[0_24px_80px_rgba(63,63,38,0.12)] backdrop-blur">
          <div className="flex items-center justify-between">
              <span className="rounded-full border border-emerald-900/15 bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                Admin
              </span>
              <Link
                href="/"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-stone-50"
              >
                Public Home
              </Link>
            </div>
          <div className="mt-8 max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Google Trends primary and expansion dashboard.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Community crawling is no longer the default path. Register manual seeds by country,
              expand them with Google Trends related top and rising queries, and monitor the run
              from here.
            </p>
          </div>
        </section>

        <PipelinePanel initialRun={latestPipelineRun} />

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">DCBest Browser Ingest</h2>
              <p className="mt-1 text-sm text-slate-600">
                Crawl DCInside DCBest pages 1 through 5 with Playwright and store row-level text
                snapshots for page composition.
              </p>
            </div>
            <form action={ingestDcbestAction}>
              <button
                className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                type="submit"
              >
                Ingest DCBest 1-5
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Manual Primary Keywords</h2>
              <p className="mt-1 text-sm text-slate-600">
                Seed topics here first. The recommended pipeline now starts from these keywords
                without crawling.
              </p>
            </div>
            <form action={createManualPrimaryKeywordAction} className="flex flex-wrap gap-3">
              <select
                name="region"
                defaultValue="KR"
                className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400"
              >
                <option value="KR">KR</option>
                <option value="JP">JP</option>
              </select>
              <input type="hidden" name="language" value="ko" />
              <input
                type="text"
                name="text"
                placeholder="예: 대선 토론, 아이폰 18"
                className="min-w-[240px] rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400"
              />
              <button
                className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                type="submit"
              >
                Add Keyword
              </button>
            </form>
          </div>

          <form action={bulkImportManualPrimaryKeywordsAction} className="mt-4 rounded-[24px] border border-black/10 bg-stone-50/70 p-4">
            <div className="text-sm font-semibold text-slate-900">Bulk Import By Country</div>
            <p className="mt-1 text-sm text-slate-600">
              Paste blocks like `[한국]`, `[일본]` and list one keyword per line.
            </p>
            <textarea
              name="bulkText"
              rows={8}
              placeholder={"[한국]\n마사지 후기\n디시 후기\n\n[일본]\nおすすめ\n正直"}
              className="mt-3 w-full rounded-[20px] border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400"
            />
            <div className="mt-3 flex justify-end">
              <button
                className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                type="submit"
              >
                Import Block
              </button>
            </div>
          </form>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {pinnedKeywords.filter((keyword) => keyword.isManual).length > 0 ? (
              pinnedKeywords
                .filter((keyword) => keyword.isManual)
                .map((keyword) => (
                  <article
                    key={keyword.id}
                    className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-950">{keyword.text}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {keyword.region} · {keyword.language} · {keyword.normalizedText}
                        </div>
                      </div>
                      <form action={deleteManualPrimaryKeywordAction}>
                        <input type="hidden" name="keywordId" value={String(keyword.id)} />
                        <button
                          className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-stone-100"
                          type="submit"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </article>
                ))
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/70 px-4 py-6 text-sm text-slate-500">
                No manual primary keywords yet.
              </div>
            )}
          </div>
        </section>

        {pinnedKeywords.length > 0 ? (
          <section className="rounded-[28px] border border-black/10 bg-[#152218] p-6 text-white shadow-[0_16px_60px_rgba(24,32,22,0.22)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Pinned Primary Keywords</h2>
                <p className="mt-1 text-sm text-emerald-100/80">
                  Hand-picked keywords surfaced directly from the primary keyword inventory.
                </p>
              </div>
              <Link href="/keywords?pinned=1&sort=pinned" className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15">Manage Pins</Link>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {pinnedKeywords.map((keyword) => {
                const metric = keyword.metrics[0];
                const keywordSourceIds = parseKeywordSourceIds(keyword.sourceIdsRaw);

                return (
                  <article
                    key={keyword.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{keyword.text}</div>
                        <div className="mt-1 text-xs text-slate-300">
                          {keyword.region} · {keyword.language} · {keyword.normalizedText}
                        </div>
                      </div>
                      <form action={updateKeywordPinnedAction}>
                        <input type="hidden" name="keywordId" value={String(keyword.id)} />
                        <input type="hidden" name="pinned" value="0" />
                        <button
                          className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/15"
                          type="submit"
                        >
                          Unpin
                        </button>
                      </form>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {keywordSourceIds.map((sourceId) => (
                        <span
                          key={sourceId}
                          className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] text-emerald-100"
                        >
                          {sourceId}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <DashboardMetric
                        label="Opportunity"
                        value={metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                      />
                      <DashboardMetric
                        label="Frequency"
                        value={metric ? String(metric.frequencyScore) : "0"}
                      />
                      <DashboardMetric
                        label="Sources"
                        value={metric ? String(metric.sourceCount) : "0"}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Ad Slots</h2>
              <p className="mt-1 text-sm text-slate-600">
                Public homepage and detail page placements. Toggle each slot without code edits.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {adSlotDefinitions.map((slot) => {
              const enabled = adSettings[slot.key];

              return (
                <article
                  key={slot.key}
                  className="rounded-2xl border border-black/8 bg-stone-50/80 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-slate-950">{slot.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{slot.key}</div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                        enabled
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{slot.description}</p>
                  <form action={updateAdSlotEnabledAction} className="mt-4">
                    <input type="hidden" name="slotKey" value={slot.key} />
                    <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
                    <button
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        enabled
                          ? "border border-black/10 bg-white text-slate-800 hover:bg-stone-100"
                          : "bg-slate-950 text-white hover:bg-slate-800"
                      }`}
                      type="submit"
                    >
                      {enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        </section>
        <section className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Primary Keywords</h2>
                <div className="flex items-center gap-2">
                  <code className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                    POST /api/extract/secondary
                  </code>
                  <Link
                    href="/keywords"
                    className="rounded-full border border-black/10 bg-slate-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    View All
                  </Link>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {keywords.length > 0 ? (
                  keywords.map((keyword) => {
                    const metric = keyword.metrics[0];

                    return (
                      <div
                        key={keyword.id}
                        className="flex items-center justify-between rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{keyword.text}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {keyword.region} · {keyword.language} · {keyword.normalizedText}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">
                            {metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {metric
                              ? `${metric.sourceCount} src / ${metric.frequencyScore} freq`
                              : "no metric"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/70 px-4 py-6 text-sm text-slate-500">
                    Add manual primary keywords above, then run `Run Manual Expansion`.
                  </div>
                )}
              </div>
        </section>
      </div>
    </main>
  );
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-emerald-100/70">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
