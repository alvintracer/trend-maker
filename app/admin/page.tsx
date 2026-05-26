import type { Metadata } from "next";
import Link from "next/link";

import { updateAdSlotEnabledAction } from "@/app/admin/ad-actions";
import { runFullPipelineAction } from "@/app/admin/pipeline-actions";
import { updateKeywordPinnedAction } from "@/app/keywords/actions";
import { getAdSlotSettingsMap } from "@/lib/ad-settings";
import { adSlotDefinitions } from "@/lib/adsterra";
import {
  getPinnedPrimaryKeywords,
  getTopPrimaryKeywords,
  parseKeywordSourceIds,
} from "@/lib/keyword-repository";
import { pipelineStages } from "@/lib/seed-data";
import { getSourceStats, getSources } from "@/lib/source-repository";

export const metadata: Metadata = {
  title: "Admin",
  description: "CommunityWikiKorea 운영 대시보드",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const [sources, stats, keywords, pinnedKeywords, adSettings] = await Promise.all([
    getSources(),
    getSourceStats(),
    getTopPrimaryKeywords(),
    getPinnedPrimaryKeywords(8),
    getAdSlotSettingsMap(),
  ]);
  const sourceNameById = new Map(sources.map((source) => [source.externalId, source.name]));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f5e9_0%,#f5f1e8_45%,#f8f7f2_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10">
        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[28px] border border-black/10 bg-white/85 p-8 shadow-[0_24px_80px_rgba(63,63,38,0.12)] backdrop-blur">
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
                CommunityWikiKorea operations dashboard.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Source inventory, crawler health, primary keyword pins, and pipeline progress
                live here. Keep this route for internal workflow and review.
              </p>
              <form action={runFullPipelineAction} className="mt-6">
                <button
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                  type="submit"
                >
                  Run Full Pipeline
                </button>
              </form>
              <p className="mt-3 text-sm text-slate-500">
                Default flow: ingest 4 sources, extract primary keywords, generate secondary
                keywords, run analysis, cluster hubs, generate pages, then publish eligible
                results.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard
              label="Sources"
              value={String(stats.totalCount)}
              detail={`${stats.activeCount} active`}
            />
            <StatCard
              label="Avg Trust"
              value={`${stats.averageTrustScore}`}
              detail="manual bootstrap score"
            />
            <StatCard
              label="Raw Docs"
              value={`${stats.rawDocumentCount}`}
              detail="stored list snapshots"
            />
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
              <Link
                href="/keywords?pinned=1&sort=pinned"
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
              >
                Manage Pins
              </Link>
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
                        <div className="mt-1 text-xs text-slate-300">{keyword.normalizedText}</div>
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
                          {sourceNameById.get(sourceId) ?? sourceId}
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

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Registered Sources</h2>
              <span className="text-sm text-slate-500">Initial manual inventory</span>
            </div>
            <div className="mt-5 grid gap-4">
              {sources.map((source) => (
                <article
                  key={source.id}
                  className="rounded-2xl border border-black/8 bg-stone-50/80 p-5 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-900">{source.name}</h3>
                        <StatusBadge status={source.status} />
                        {["dcinside", "fmkorea", "mlbpark", "dogdrip"].includes(
                          source.externalId,
                        ) ? (
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
                            crawler ready
                          </span>
                        ) : null}
                      </div>
                      <a
                        href={source.url}
                        className="mt-1 inline-block text-sm text-slate-500 hover:text-slate-900"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.url}
                      </a>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
                      trust {source.trustScore}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-600">
                    <Pill>{source.kind}</Pill>
                    <Pill>{source.category}</Pill>
                    <Pill>{source.language}</Pill>
                    <Pill>{source.crawlIntervalHours}h</Pill>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{source.notes}</p>
                  {source.externalId === "fmkorea" ? (
                    <div className="mt-4 rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-900">
                          FMKorea Health
                        </span>
                        <CrawlStatusBadge status={source.lastCrawlStatus} />
                        {source.lastCrawlMethod ? (
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
                            {source.lastCrawlMethod}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-sm text-slate-700">
                        {source.lastCrawlDetail ?? "No crawl detail yet"}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <span>
                      last crawl{" "}
                      {source.lastCrawledAt
                        ? new Intl.DateTimeFormat("ko-KR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(source.lastCrawledAt)
                        : "not yet"}
                    </span>
                    <code className="rounded-lg bg-white px-2 py-1 text-[11px] text-slate-700">
                      POST /api/ingest/{source.externalId}
                    </code>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[28px] border border-black/10 bg-[#152218] p-6 text-white shadow-[0_16px_60px_rgba(24,32,22,0.22)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Pipeline</h2>
                <span className="text-sm text-emerald-100/80">Build order</span>
              </div>
              <div className="mt-5 space-y-4">
                {pipelineStages.map((stage, index) => (
                  <div key={stage.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{stage.name}</h3>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-emerald-100/80">
                            {stage.state}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{stage.summary}</p>
                        <p className="mt-2 text-sm font-medium text-emerald-200">{stage.output}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Primary Keywords</h2>
                <div className="flex items-center gap-2">
                  <code className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                    POST /api/extract/primary
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
                          <div className="mt-1 text-xs text-slate-500">{keyword.normalizedText}</div>
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
                    Run ingestion for `dcinside` and `fmkorea`, then call `POST /api/extract/primary`.
                  </div>
                )}
              </div>
            </div>
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

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/80 p-5 shadow-[0_12px_40px_rgba(53,58,42,0.08)] backdrop-blur">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-sm text-slate-600">{detail}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px]">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: "active" | "review" | "paused" }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${
        status === "active"
          ? "bg-emerald-100 text-emerald-900"
          : status === "review"
            ? "bg-amber-100 text-amber-900"
            : "bg-slate-200 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

function CrawlStatusBadge({ status }: { status?: string | null }) {
  const normalizedStatus = status ?? "idle";
  const className =
    normalizedStatus === "success"
      ? "bg-emerald-100 text-emerald-900"
      : normalizedStatus === "error"
        ? "bg-rose-100 text-rose-900"
        : "bg-slate-200 text-slate-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${className}`}
    >
      {normalizedStatus}
    </span>
  );
}
