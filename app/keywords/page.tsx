import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  createManualPrimaryKeywordAction,
  deleteManualPrimaryKeywordAction,
  updateKeywordPinnedAction,
} from "@/app/keywords/actions";
import { clusterSecondaryKeywordsBulkAction } from "@/app/keywords/hub-actions";
import {
  generateKeywordAnalysisAction,
  generateKeywordAnalysisBulkAction,
} from "@/app/keywords/analysis-actions";
import {
  generateKeywordPageAction,
  generateKeywordPageBulkAction,
} from "@/app/keywords/page-actions";
import {
  publishGeneratedPageAction,
  publishHubAction,
  unpublishGeneratedPageAction,
  unpublishHubAction,
} from "@/app/keywords/publish-actions";
import { getGeneratedPages } from "@/lib/generated-page-service";
import { getHubInventory } from "@/lib/hub-service";
import {
  generateSecondaryKeywordsAction,
  generateSecondaryKeywordsBulkAction,
} from "@/app/keywords/secondary-actions";
import {
  getPrimaryKeywords,
  getTertiaryKeywords,
  isManualKeywordSource,
  parseKeywordSourceIds,
} from "@/lib/keyword-repository";
import {
  getSecondaryKeywordInventory,
  getSecondaryKeywordRules,
  getSecondaryKeywordsForPrimaryKeywords,
  parseSecondaryStatuses,
} from "@/lib/secondary-keyword-service";
import { getPublishRules } from "@/lib/publish-service";
import { getSources } from "@/lib/source-repository";

type KeywordsPageProps = {
  searchParams: Promise<{
    sort?: string;
    source?: string | string[];
    pinned?: string;
    view?: string;
    secondaryStatus?: string;
  }>;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const SORT_OPTIONS = [
  { value: "opportunity", label: "Opportunity" },
  { value: "frequency", label: "Frequency" },
  { value: "coverage", label: "Source Coverage" },
  { value: "newest", label: "Newest" },
  { value: "alpha", label: "Alphabetical" },
  { value: "pinned", label: "Pinned First" },
] as const;

const VIEW_OPTIONS = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "tertiary", label: "Tertiary" },
  { value: "hubs", label: "Hubs" },
  { value: "generated", label: "Generated" },
] as const;

const SECONDARY_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "tracking", label: "Tracking" },
  { value: "analyzed", label: "Analyzed" },
  { value: "blocked", label: "Blocked" },
  { value: "all", label: "All" },
] as const;

type SortOptionValue = (typeof SORT_OPTIONS)[number]["value"];
type ViewOptionValue = (typeof VIEW_OPTIONS)[number]["value"];

const MANUAL_SOURCE_OPTION = {
  id: -1,
  externalId: "manual",
  name: "Manual",
};

export async function KeywordsInventoryPage({ searchParams }: KeywordsPageProps) {
  const params = await searchParams;
  const selectedSort = normalizeSort(params.sort);
  const selectedView = normalizeView(params.view);
  const selectedSourceIds = toArray(params.source);
  const pinnedOnly = params.pinned === "1";
  const selectedSecondaryStatus = normalizeSecondaryStatus(params.secondaryStatus);
  const secondaryStatuses = parseSecondaryStatuses(selectedSecondaryStatus);

  const [keywords, sources] = await Promise.all([
    getPrimaryKeywords({
      limit: 120,
      sort: selectedSort,
      sourceIds: selectedSourceIds,
      pinnedOnly,
    }),
    getSources(),
  ]);
  const tertiaryKeywords = await getTertiaryKeywords({
    limit: 200,
    sort: selectedSort === "pinned" ? "opportunity" : selectedSort,
    sourceIds: selectedSourceIds,
  });
  const generatedPages = await getGeneratedPages(200);
  const hubs = await getHubInventory(200, selectedSourceIds);

  const sourceOptions = [...sources, MANUAL_SOURCE_OPTION];
  const sourceNameById = new Map(sourceOptions.map((source) => [source.externalId, source.name]));
  const secondaryKeywordsByPrimaryId = await getSecondaryKeywordsForPrimaryKeywords(
    keywords.map((keyword) => keyword.id),
  );
  const secondaryRules = getSecondaryKeywordRules();
  const publishRules = getPublishRules();
  const secondaryInventory = await getSecondaryKeywordInventory({
    parentKeywordIds: keywords.map((keyword) => keyword.id),
    limit: 240,
    statuses: secondaryStatuses,
    sort:
      selectedSort === "alpha"
        ? "alpha"
        : selectedSort === "newest"
          ? "newest"
          : "opportunity",
  });

  const maxCoverage = Math.max(...keywords.map((keyword) => keyword.metrics[0]?.sourceCount ?? 0), 0);
  const visibleSecondaryCount = secondaryInventory.length;
  const visibleTertiaryCount = tertiaryKeywords.length;
  const visibleHubCount = hubs.length;
  const visibleGeneratedCount = generatedPages.filter((page) => {
    if (selectedSourceIds.length === 0) {
      return true;
    }

    const pageSourceIds = parseKeywordSourceIds(page.keyword.sourceIdsRaw);
    return selectedSourceIds.some((sourceId) => pageSourceIds.includes(sourceId));
  }).length;
  const visiblePinnedCount = keywords.filter((keyword) => keyword.pinned).length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#edf7ef_0%,#f6f0e6_46%,#f8f7f2_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <section className="rounded-[28px] border border-black/10 bg-white/85 p-8 shadow-[0_24px_80px_rgba(63,63,38,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
                Admin Keyword Inventory
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Primary, secondary, hub, and page inventory.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                수동 primary/secondary, Trends 확장 결과, 허브 클러스터, 생성 페이지를 한 곳에서
                확인하고 배치 액션을 실행합니다.
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-full border border-black/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Back to Admin
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <KeywordStat
            label={
              selectedView === "primary"
                ? "Visible Primary"
                : selectedView === "secondary"
                  ? "Visible Secondary"
                  : selectedView === "tertiary"
                    ? "Visible Tertiary"
                    : selectedView === "hubs"
                      ? "Visible Hubs"
                      : "Visible Pages"
            }
            value={String(
              selectedView === "primary"
                ? keywords.length
                : selectedView === "secondary"
                  ? visibleSecondaryCount
                  : selectedView === "tertiary"
                    ? visibleTertiaryCount
                    : selectedView === "hubs"
                      ? visibleHubCount
                      : visibleGeneratedCount,
            )}
            detail={selectedSourceIds.length > 0 ? `${selectedSourceIds.length} source filters` : "all active sources"}
          />
          <KeywordStat
            label="Pinned Primary"
            value={String(visiblePinnedCount)}
            detail="visible pinned keywords"
          />
          <KeywordStat
            label="Best Coverage"
            value={String(maxCoverage)}
            detail="max source count"
          />
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={buildKeywordsHref({
                  sort: selectedSort,
                  sourceIds: selectedSourceIds,
                  pinnedOnly,
                  view: option.value,
                  secondaryStatus: selectedSecondaryStatus,
                })}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedView === option.value
                    ? "bg-slate-950 text-white"
                    : "border border-black/10 bg-white text-slate-700 hover:bg-stone-50"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>

          <form className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]" method="get">
            <input type="hidden" name="view" value={selectedView} />
            <div>
              <div className="text-sm font-semibold text-slate-900">Sources</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sourceOptions.map((source) => {
                  const checked = selectedSourceIds.includes(source.externalId);

                  return (
                    <label
                      key={source.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                        checked
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-black/10 bg-stone-50 text-slate-700"
                      }`}
                    >
                      <input
                        className="sr-only"
                        type="checkbox"
                        name="source"
                        value={source.externalId}
                        defaultChecked={checked}
                      />
                      <span>{source.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-900">Sort</span>
                <select
                  className="h-11 rounded-2xl border border-black/10 bg-stone-50 px-3 text-sm text-slate-900"
                  name="sort"
                  defaultValue={selectedSort}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedView === "secondary" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-900">Status</span>
                  <select
                    className="h-11 rounded-2xl border border-black/10 bg-stone-50 px-3 text-sm text-slate-900"
                    name="secondaryStatus"
                    defaultValue={selectedSecondaryStatus}
                  >
                    {SECONDARY_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : selectedView === "primary" ? (
                <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-stone-50 px-4 py-3">
                  <input type="checkbox" name="pinned" value="1" defaultChecked={pinnedOnly} />
                  <span className="text-sm font-medium text-slate-900">Pinned only</span>
                </label>
              ) : selectedView === "tertiary" ? (
                <div className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm text-slate-500">
                  Tertiary keywords follow the current source filters and sort order.
                </div>
              ) : selectedView === "hubs" ? (
                <div className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm text-slate-500">
                  Hubs group similar secondary keywords under one canonical topic.
                </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm text-slate-500">
                  Generated pages follow source filters and latest generation order.
                </div>
              )}
              <div className="flex items-end gap-2 sm:col-span-2">
                <button
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  type="submit"
                >
                  Apply Filters
                </button>
                <Link
                  href={buildKeywordsHref({
                    view: selectedView,
                    secondaryStatus: selectedSecondaryStatus,
                  })}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-stone-50"
                >
                  Reset
                </Link>
              </div>
            </div>
          </form>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/80 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          {selectedView === "primary" ? (
            <div className="mb-6 rounded-[24px] border border-amber-900/10 bg-amber-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Manual Primary Keywords</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Added here, pinned immediately, and kept until you delete them.
                  </div>
                </div>
                <form action={createManualPrimaryKeywordAction} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    name="text"
                    placeholder="Add primary keyword"
                    className="h-11 min-w-[240px] rounded-2xl border border-black/10 bg-white px-4 text-sm text-slate-900 outline-none"
                  />
                  <button
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                    type="submit"
                  >
                    Add Manual Keyword
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {selectedView === "primary"
                  ? "Primary Inventory"
                  : selectedView === "secondary"
                    ? "Secondary Inventory"
                    : "Tertiary Inventory"}
              </h2>
              <div className="mt-1 text-sm text-slate-500">
                {selectedView === "primary"
                  ? "Current first-pass keyword candidates from ingested titles."
                  : selectedView === "secondary"
                    ? "Google Suggest expansions generated from the visible primary set."
                    : selectedView === "tertiary"
                      ? "Related keywords generated from secondary keyword analysis."
                      : selectedView === "hubs"
                        ? "Canonical hub clusters built from similar secondary keywords."
                        : "SERP draft pages generated from analyzed secondary keywords."}
              </div>
              {selectedView === "secondary" ? (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <MetaPill>opportunity {secondaryRules.minOpportunityScore}+</MetaPill>
                  <MetaPill>suggest {secondaryRules.minSuggestScore}+</MetaPill>
                  <MetaPill>analyzed {secondaryRules.analyzedOpportunityScore}+</MetaPill>
                </div>
              ) : selectedView === "hubs" || selectedView === "generated" ? (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <MetaPill>publish opp {publishRules.minRepresentativeOpportunity}+</MetaPill>
                  <MetaPill>summary {publishRules.minSummaryLength}+ chars</MetaPill>
                  <MetaPill>tertiary {publishRules.minTertiaryCount}+</MetaPill>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                {selectedView === "primary"
                  ? "POST /api/extract/primary"
                  : selectedView === "secondary"
                    ? "POST /api/extract/secondary"
                    : selectedView === "tertiary"
                      ? "POST /api/analyze/keywords"
                      : selectedView === "hubs"
                        ? "POST /api/extract/secondary"
                        : "POST /api/generate/pages"}
              </code>
              <form action={generateSecondaryKeywordsBulkAction}>
                {keywords.map((keyword) => (
                  <input key={keyword.id} type="hidden" name="keywordIds" value={String(keyword.id)} />
                ))}
                <button
                  className="rounded-full border border-black/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="submit"
                  disabled={keywords.length === 0}
                >
                  Generate Secondary for Visible
                </button>
              </form>
              {selectedView === "secondary" ? (
                <form action={clusterSecondaryKeywordsBulkAction}>
                  {secondaryInventory.map((keyword) => (
                    <input key={keyword.id} type="hidden" name="keywordIds" value={String(keyword.id)} />
                  ))}
                  <button
                    className="rounded-full border border-black/10 bg-violet-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:bg-violet-200"
                    type="submit"
                    disabled={secondaryInventory.length === 0}
                  >
                    Cluster Visible into Hubs
                  </button>
                </form>
              ) : null}
              {selectedView === "secondary" ? (
                <form action={generateKeywordAnalysisBulkAction}>
                  {secondaryInventory.map((keyword) => (
                    <input key={keyword.id} type="hidden" name="keywordIds" value={String(keyword.id)} />
                  ))}
                  <button
                    className="rounded-full border border-black/10 bg-emerald-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-emerald-200"
                    type="submit"
                    disabled={secondaryInventory.length === 0}
                  >
                    Generate Analysis for Visible
                  </button>
                </form>
              ) : null}
              {selectedView === "secondary" ? (
                <form action={generateKeywordPageBulkAction}>
                  {secondaryInventory
                    .filter((keyword) => keyword.status === "analyzed")
                    .map((keyword) => (
                      <input key={keyword.id} type="hidden" name="keywordIds" value={String(keyword.id)} />
                    ))}
                  <button
                    className="rounded-full border border-black/10 bg-sky-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-900 disabled:cursor-not-allowed disabled:bg-sky-200"
                    type="submit"
                    disabled={secondaryInventory.filter((keyword) => keyword.status === "analyzed").length === 0}
                  >
                    Generate Pages for Analyzed
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          {selectedView === "primary" ? (
            <div className="mt-5 grid gap-3">
              {keywords.length > 0 ? (
                keywords.map((keyword, index) => {
                  const metric = keyword.metrics[0];
                  const keywordSourceIds = parseKeywordSourceIds(keyword.sourceIdsRaw);
                  const secondaryKeywords = secondaryKeywordsByPrimaryId.get(keyword.id) ?? [];
                  const isManual = keyword.isManual || isManualKeywordSource(keyword.sourceIdsRaw);

                  return (
                    <article
                      key={keyword.id}
                      className="grid gap-4 rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4 md:grid-cols-[56px_minmax(0,1fr)_220px]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{keyword.text}</h3>
                          <StatusPill status={keyword.status} />
                          {keyword.pinned ? <PinnedPill /> : null}
                          {isManual ? <ManualPill /> : null}
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">
                          {keyword.normalizedText}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-600">
                          <MetaPill>{keyword.level}</MetaPill>
                          <MetaPill>{keyword.language}</MetaPill>
                          <MetaPill>{keyword.region}</MetaPill>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {keywordSourceIds.map((sourceId) => (
                            <SourcePill key={sourceId}>
                              {sourceNameById.get(sourceId) ?? sourceId}
                            </SourcePill>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <form action={updateKeywordPinnedAction}>
                            <input type="hidden" name="keywordId" value={String(keyword.id)} />
                            <input type="hidden" name="pinned" value={keyword.pinned ? "0" : "1"} />
                            <button
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                keyword.pinned
                                  ? "border border-black/10 bg-white text-slate-700 hover:bg-stone-100"
                                  : "bg-slate-950 text-white hover:bg-slate-800"
                              }`}
                              type="submit"
                            >
                              {keyword.pinned ? "Remove from Dashboard" : "Pin to Dashboard"}
                            </button>
                          </form>
                          {isManual ? (
                            <form action={deleteManualPrimaryKeywordAction}>
                              <input type="hidden" name="keywordId" value={String(keyword.id)} />
                              <button
                                className="rounded-full border border-red-900/10 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 transition-colors hover:bg-red-100"
                                type="submit"
                              >
                                Delete Manual Keyword
                              </button>
                            </form>
                          ) : null}
                          <form action={generateSecondaryKeywordsAction}>
                            <input type="hidden" name="keywordId" value={String(keyword.id)} />
                            <button
                              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-stone-100"
                              type="submit"
                            >
                              Generate Secondary
                            </button>
                          </form>
                        </div>
                        {secondaryKeywords.length > 0 ? (
                          <div className="mt-4 rounded-2xl border border-black/8 bg-white px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Secondary Keywords
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {secondaryKeywords.map((secondaryKeyword) => (
                              <span
                                key={secondaryKeyword.id}
                                className="rounded-full border border-sky-900/12 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-900"
                              >
                                {secondaryKeyword.suggestedKeyword.text}
                                {secondaryKeyword.suggestedKeyword.metrics[0]
                                  ? ` · ${secondaryKeyword.suggestedKeyword.metrics[0].opportunityScore.toFixed(1)}`
                                  : ""}
                              </span>
                            ))}
                          </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
                        <MetricRow
                          label="Opportunity"
                          value={metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                        />
                        <MetricRow
                          label="Frequency"
                          value={metric ? String(metric.frequencyScore) : "0"}
                        />
                        <MetricRow
                          label="Sources"
                          value={metric ? String(metric.sourceCount) : "0"}
                        />
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState>
                  No keywords match this filter. Adjust the source selection or regenerate
                  primary keywords.
                </EmptyState>
              )}
            </div>
          ) : selectedView === "secondary" ? (
            <div className="mt-5 grid gap-3">
              {secondaryInventory.length > 0 ? (
                secondaryInventory.map((entry, index) => {
                  const metric = entry.metrics[0];
                  const latestAnalysis = entry.analyses[0];
                  const latestPage = entry.generatedPages[0];
                  const parentKeywords = entry.suggestedBy
                    .map((relation) => relation.parentKeyword)
                    .sort((left, right) => left.text.localeCompare(right.text, "ko"));
                  const parentSourceIds = [
                    ...new Set(
                      parentKeywords.flatMap((parentKeyword) =>
                        parseKeywordSourceIds(parentKeyword.sourceIdsRaw),
                      ),
                    ),
                  ];

                  return (
                    <article
                      key={entry.id}
                      className="grid gap-4 rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4 md:grid-cols-[56px_minmax(0,1fr)_220px]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-950 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {entry.text}
                          </h3>
                          <StatusPill status={entry.status} />
                          <MetaPill>{entry.suggestedBy.length} parents</MetaPill>
                          <MetaPill>{metric ? metric.suggestScore.toFixed(2) : "0.00"} suggest</MetaPill>
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">
                          {entry.normalizedText}
                        </div>
                        {latestAnalysis ? (
                          <div className="mt-3 rounded-2xl border border-emerald-900/10 bg-emerald-50/70 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-900">
                              Latest Analysis
                            </div>
                            <div className="mt-2 text-sm font-medium text-slate-900">
                              {latestAnalysis.intent || "Intent not set"}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-700">
                              {latestAnalysis.snippetTitle || latestAnalysis.summary || "No summary"}
                            </div>
                          </div>
                        ) : null}
                        {latestPage ? (
                          <div className="mt-3 rounded-2xl border border-sky-900/10 bg-sky-50/70 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-900">
                              Generated Page
                            </div>
                            <a
                              href={latestPage.canonicalPath}
                              className="mt-2 block text-sm font-semibold text-sky-900 hover:underline"
                            >
                              {latestPage.title}
                            </a>
                            <div className="mt-1 text-xs text-slate-600">
                              {latestPage.status} · {latestPage.slug}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-4 rounded-2xl border border-black/8 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Parent Primary Keywords
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {parentKeywords.map((parentKeyword) => (
                              <span
                                key={`${entry.id}-${parentKeyword.id}`}
                                className="rounded-full border border-black/10 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-slate-800"
                              >
                                {parentKeyword.text}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {parentSourceIds.map((sourceId) => (
                              <SourcePill key={`${entry.id}-${sourceId}`}>
                                {sourceNameById.get(sourceId) ?? sourceId}
                              </SourcePill>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="flex flex-wrap gap-2">
                            <form action={generateKeywordAnalysisAction}>
                              <input type="hidden" name="keywordId" value={String(entry.id)} />
                              <button
                                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-stone-100"
                                type="submit"
                              >
                                Generate Analysis
                              </button>
                            </form>
                            <form action={generateKeywordPageAction}>
                              <input type="hidden" name="keywordId" value={String(entry.id)} />
                              <button
                                className="rounded-full border border-black/10 bg-sky-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-900"
                                type="submit"
                              >
                                Generate Page
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
                        <MetricRow
                          label="Opportunity"
                          value={metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                        />
                        <MetricRow
                          label="Coverage"
                          value={metric ? String(metric.sourceCount) : "0"}
                        />
                        <MetricRow
                          label="Updated"
                          value={formatDate(entry.lastSeenAt)}
                        />
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState>
                  No secondary keywords are available for this filter yet. Run secondary
                  generation for the visible primary set.
                </EmptyState>
              )}
            </div>
          ) : selectedView === "tertiary" ? (
            <div className="mt-5 grid gap-3">
              {tertiaryKeywords.length > 0 ? (
                tertiaryKeywords.map((entry, index) => {
                  const metric = entry.metrics[0];
                  const parentKeyword = entry.parentKeyword;
                  const parentAnalysis = parentKeyword?.analyses[0];
                  const tertiarySourceIds = parseKeywordSourceIds(entry.sourceIdsRaw);

                  return (
                    <article
                      key={entry.id}
                      className="grid gap-4 rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4 md:grid-cols-[56px_minmax(0,1fr)_220px]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-950 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{entry.text}</h3>
                          <StatusPill status={entry.status} />
                          <MetaPill>tertiary</MetaPill>
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">
                          {entry.normalizedText}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tertiarySourceIds.map((sourceId) => (
                            <SourcePill key={`${entry.id}-${sourceId}`}>
                              {sourceNameById.get(sourceId) ?? sourceId}
                            </SourcePill>
                          ))}
                        </div>
                        {parentKeyword ? (
                          <div className="mt-4 rounded-2xl border border-black/8 bg-white px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Parent Secondary Keyword
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">
                              {parentKeyword.text}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {parentAnalysis?.snippetTitle || parentAnalysis?.intent || "No latest analysis summary"}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
                        <MetricRow
                          label="Opportunity"
                          value={metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                        />
                        <MetricRow
                          label="Commercial"
                          value={metric ? metric.commercialScore.toFixed(2) : "0.00"}
                        />
                        <MetricRow label="Updated" value={formatDate(entry.lastSeenAt)} />
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState>
                  No tertiary keywords are available for this filter yet. Generate analysis from
                  the secondary inventory first.
                </EmptyState>
              )}
            </div>
          ) : selectedView === "hubs" ? (
            <div className="mt-5 grid gap-3">
              {hubs.length > 0 ? (
                hubs.map((hub, index) => {
                  const representative = hub.representativeKeyword;
                  const metric = representative?.metrics[0];
                  const secondaryCount = hub.secondaryKeywords.length;
                  const tertiaryCount = hub.secondaryKeywords.reduce(
                    (total, keyword) => total + keyword.childKeywords.length,
                    0,
                  );
                  const hubSourceIds = [
                    ...new Set(
                      hub.secondaryKeywords.flatMap((keyword) =>
                        parseKeywordSourceIds(keyword.sourceIdsRaw),
                      ),
                    ),
                  ];

                  return (
                    <article
                      key={hub.id}
                      className="grid gap-4 rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4 md:grid-cols-[56px_minmax(0,1fr)_220px]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-950 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{hub.name}</h3>
                          <MetaPill>{hub.status}</MetaPill>
                          {hub.generatedPage ? <MetaPill>page ready</MetaPill> : null}
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">{hub.slug}</div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                          {hub.summary ?? representative?.analyses[0]?.summary ?? "No hub summary yet"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hubSourceIds.map((sourceId) => (
                            <SourcePill key={`${hub.id}-${sourceId}`}>
                              {sourceNameById.get(sourceId) ?? sourceId}
                            </SourcePill>
                          ))}
                        </div>
                        {hub.generatedPage ? (
                          <div className="mt-3 rounded-2xl border border-sky-900/10 bg-sky-50/70 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-900">
                              Generated Page
                            </div>
                            <a
                              href={hub.generatedPage.canonicalPath}
                              className="mt-2 block text-sm font-semibold text-sky-900 hover:underline"
                            >
                              {hub.generatedPage.title}
                            </a>
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {hub.status === "published" ? (
                            <form action={unpublishHubAction}>
                              <input type="hidden" name="hubId" value={String(hub.id)} />
                              <button
                                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-stone-100"
                                type="submit"
                              >
                                Unpublish Hub
                              </button>
                            </form>
                          ) : (
                            <form action={publishHubAction}>
                              <input type="hidden" name="hubId" value={String(hub.id)} />
                              <button
                                className="rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-100"
                                type="submit"
                              >
                                Publish Hub
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
                        <MetricRow label="Secondary" value={String(secondaryCount)} />
                        <MetricRow label="Tertiary" value={String(tertiaryCount)} />
                        <MetricRow
                          label="Opportunity"
                          value={metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                        />
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState>
                  No hubs are available for this filter yet. Cluster the secondary inventory
                  first.
                </EmptyState>
              )}
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {generatedPages.filter((page) => {
                if (selectedSourceIds.length === 0) {
                  return true;
                }

                const pageSourceIds = parseKeywordSourceIds(page.keyword.sourceIdsRaw);
                return selectedSourceIds.some((sourceId) => pageSourceIds.includes(sourceId));
              }).length > 0 ? (
                generatedPages
                  .filter((page) => {
                    if (selectedSourceIds.length === 0) {
                      return true;
                    }

                    const pageSourceIds = parseKeywordSourceIds(page.keyword.sourceIdsRaw);
                    return selectedSourceIds.some((sourceId) => pageSourceIds.includes(sourceId));
                  })
                  .map((page, index) => {
                    const metric = page.keyword.metrics[0];
                    const pageSourceIds = parseKeywordSourceIds(page.keyword.sourceIdsRaw);

                    return (
                      <article
                        key={page.id}
                        className="grid gap-4 rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4 md:grid-cols-[56px_minmax(0,1fr)_220px]"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-950 text-sm font-semibold text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={page.canonicalPath}
                              className="text-base font-semibold text-slate-900 hover:underline"
                            >
                              {page.title}
                            </a>
                            <MetaPill>{page.status}</MetaPill>
                          </div>
                          <div className="mt-1 break-all text-xs text-slate-500">{page.slug}</div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">{page.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {pageSourceIds.map((sourceId) => (
                              <SourcePill key={`${page.id}-${sourceId}`}>
                                {sourceNameById.get(sourceId) ?? sourceId}
                              </SourcePill>
                            ))}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {page.status === "published" ? (
                              <form action={unpublishGeneratedPageAction}>
                                <input type="hidden" name="pageId" value={String(page.id)} />
                                <button
                                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-stone-100"
                                  type="submit"
                                >
                                  Unpublish Page
                                </button>
                              </form>
                            ) : (
                              <form action={publishGeneratedPageAction}>
                                <input type="hidden" name="pageId" value={String(page.id)} />
                                <button
                                  className="rounded-full border border-emerald-900/10 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-100"
                                  type="submit"
                                >
                                  Publish Page
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
                          <MetricRow
                            label="Keyword"
                            value={page.keyword.text}
                          />
                          <MetricRow
                            label="Opportunity"
                            value={metric ? metric.opportunityScore.toFixed(2) : "0.00"}
                          />
                          <MetricRow
                            label="Generated"
                            value={formatDate(page.lastGeneratedAt)}
                          />
                        </div>
                      </article>
                    );
                  })
              ) : (
                <EmptyState>
                  No generated pages are available for this filter yet. Generate analysis and
                  page drafts from the secondary inventory first.
                </EmptyState>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default async function KeywordsPage({ searchParams }: KeywordsPageProps) {
  const params = await searchParams;
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
    } else {
      search.set(key, value);
    }
  }

  const query = search.toString();
  redirect(query ? `/admin/keywords?${query}` : "/admin/keywords");
}

function normalizeSort(value?: string) {
  const supportedValues = SORT_OPTIONS.map((option) => option.value) as readonly string[];
  return supportedValues.includes(value ?? "") ? (value as SortOptionValue) : "opportunity";
}

function normalizeView(value?: string) {
  const supportedValues = VIEW_OPTIONS.map((option) => option.value) as readonly string[];
  return supportedValues.includes(value ?? "") ? (value as ViewOptionValue) : "primary";
}

function toArray(value?: string | string[]) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function buildKeywordsHref({
  sort,
  sourceIds = [],
  pinnedOnly,
  view,
  secondaryStatus,
}: {
  sort?: string;
  sourceIds?: string[];
  pinnedOnly?: boolean;
  view?: string;
  secondaryStatus?: string;
}) {
  const searchParams = new URLSearchParams();

  if (sort) {
    searchParams.set("sort", sort);
  }

  if (view) {
    searchParams.set("view", view);
  }

  if (secondaryStatus && secondaryStatus !== "active") {
    searchParams.set("secondaryStatus", secondaryStatus);
  }

  if (pinnedOnly) {
    searchParams.set("pinned", "1");
  }

  for (const sourceId of sourceIds) {
    searchParams.append("source", sourceId);
  }

  const query = searchParams.toString();
  return query ? `/admin/keywords?${query}` : "/admin/keywords";
}

function normalizeSecondaryStatus(value?: string) {
  const supportedValues = SECONDARY_STATUS_OPTIONS.map((option) => option.value) as readonly string[];
  return supportedValues.includes(value ?? "") ? value ?? "active" : "active";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function KeywordStat({
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px]">
      {children}
    </span>
  );
}

function SourcePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-emerald-900/12 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-900">
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-900">
      {status}
    </span>
  );
}

function PinnedPill() {
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-amber-900">
      pinned
    </span>
  );
}

function ManualPill() {
  return (
    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-violet-900">
      manual
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/70 px-4 py-6 text-sm text-slate-500">
      {children}
    </div>
  );
}
