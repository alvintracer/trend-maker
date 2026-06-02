import type { Metadata } from "next";
import Link from "next/link";

import {
  updateAdSlotEnabledAction,
  updateTrafficRedirectSettingsAction,
} from "@/app/admin/ad-actions";
import { logoutAdminAction } from "@/app/admin/auth-actions";
import { updatePublishThresholdAction } from "@/app/admin/publish-actions";
import {
  bulkImportManualPrimaryKeywordsAction,
  bulkImportManualSecondaryKeywordsAction,
  createManualPrimaryKeywordAction,
  deleteManualPrimaryKeywordAction,
  updateKeywordPinnedAction,
} from "@/app/keywords/actions";
import { DcbestIngestPanel } from "@/components/admin/dcbest-ingest-panel";
import { MainPageIngestPanel } from "@/components/admin/main-page-ingest-panel";
import { NamuSyncAllButton } from "@/components/admin/namu-sync-all-button";
import { NamuSyncButton } from "@/components/admin/namu-sync-button";
import { PipelinePanel } from "@/components/admin/pipeline-panel";
import { getAdSlotSettingsMap } from "@/lib/ad-settings";
import { assertAdminAuthenticated } from "@/lib/admin-auth";
import { adSlotDefinitions } from "@/lib/adsterra";
import { getGeneratedPages } from "@/lib/generated-page-service";
import {
  getManualPrimaryKeywords,
  getRecentSecondaryKeywords,
} from "@/lib/keyword-repository";
import { MAIN_PAGE_SOURCE_IDS, getMainPageSourceSettings } from "@/lib/main-page-sources";
import { NAMU_AV_ACTIVE_INITIALS } from "@/lib/namu-av-actors";
import { getLatestPipelineRun } from "@/lib/pipeline-run";
import { getPublishRulesForDisplay } from "@/lib/publish-service";
import { prisma } from "@/lib/prisma";
import { getTrafficRedirectSettings } from "@/lib/traffic-redirect-settings";

export const metadata: Metadata = {
  title: "Admin | CommunityWikiKorea",
  description: "CommunityWikiKorea 커뮤니티위키코리아 운영 대시보드",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await assertAdminAuthenticated();
  const mainPageSourceSettings = await getMainPageSourceSettings();
  const mainPageSourceSettingMap = new Map(
    mainPageSourceSettings.map((setting) => [setting.sourceExternalId, setting]),
  );

  const [
    manualPrimaryKeywords,
    recentSecondaryKeywords,
    adSettings,
    latestPipelineRun,
    publishRules,
    trafficRedirectSettings,
    dcbestSource,
    dcbestDocumentCount,
    mainPageSources,
    generatedPages,
    namuPages,
  ] = await Promise.all([
    getManualPrimaryKeywords(30),
    getRecentSecondaryKeywords(16),
    getAdSlotSettingsMap(),
    getLatestPipelineRun(),
    getPublishRulesForDisplay(),
    getTrafficRedirectSettings(),
    prisma.source.findUnique({
      where: {
        externalId: "dcinside-dcbest",
      },
      select: {
        id: true,
        lastCrawledAt: true,
        lastCrawlStatus: true,
        lastCrawlMethod: true,
        lastCrawlDetail: true,
      },
    }),
    prisma.rawDocument.count({
      where: {
        source: {
          externalId: "dcinside-dcbest",
        },
      },
    }),
    Promise.all(
      MAIN_PAGE_SOURCE_IDS.map(async (externalId) => {
        const [source, rawDocumentCount] = await Promise.all([
          prisma.source.findUnique({
            where: {
              externalId,
            },
            select: {
              externalId: true,
              name: true,
              lastCrawledAt: true,
              lastCrawlStatus: true,
              lastCrawlMethod: true,
              lastCrawlDetail: true,
            },
          }),
          prisma.rawDocument.count({
            where: {
              source: {
                externalId,
              },
            },
          }),
        ]);

        return {
          externalId,
          name: source?.name ?? externalId,
          rawDocumentCount,
          lastCrawledAt: source?.lastCrawledAt?.toISOString() ?? null,
          lastCrawlStatus: source?.lastCrawlStatus ?? null,
          lastCrawlMethod: source?.lastCrawlMethod ?? null,
          lastCrawlDetail: source?.lastCrawlDetail ?? null,
          enabled: mainPageSourceSettingMap.get(externalId)?.enabled ?? true,
          intervalHours: mainPageSourceSettingMap.get(externalId)?.intervalHours ?? 6,
        };
      }),
    ),
    getGeneratedPages(12),
    prisma.generatedPage.findMany({
      where: {
        keyword: {
          normalizedText: {
            startsWith: "av 배우 정보",
          },
        },
      },
      include: {
        keyword: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
    }),
  ]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0eafd_0%,#f1f5f9_45%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        <section className="rounded-[28px] border border-black/10 bg-white/85 p-8 shadow-[0_24px_80px_rgba(63,63,38,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-sky-900/15 bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-900">
              Admin
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/keywords"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-stone-50"
              >
                Keyword Inventory
              </Link>
              <Link
                href="/"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-stone-50"
              >
                Public Home
              </Link>
              <form action={logoutAdminAction}>
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
          <div className="mt-8 max-w-4xl">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              운영 페이지를 메인페이지와 상세페이지 두 축으로 나눕니다.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              메인페이지 매니지먼트는 여러 커뮤니티의 인기 게시글과 제목 기반 키워드를 갱신합니다.
              상세페이지 매니지먼트는 수동 primary에서 출발해 secondary 확장, 디시 재료 수집,
              상세페이지 생성과 퍼블리싱까지 관리합니다.
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-900">
            Main Page Management
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            메인페이지 게시글 수집과 제목 기반 키워드 갱신
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            디시 라이트, FMKorea best2, 아카라이브, Dogdrip popular/userdog 게시글 제목과 링크를
            수집하고, 메인페이지에서 보여줄 키워드를 갱신합니다.
          </p>
        </section>

        <MainPageIngestPanel initialSources={mainPageSources} />

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-900">
            Detail Page Management
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            primary에서 상세페이지 생성과 퍼블리싱까지
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            수동 primary 지정, secondary 확장, DCBest 재료 수집, 상세페이지 생성, 퍼블리싱 기준을
            한 흐름으로 관리합니다.
          </p>
        </section>

        <PipelinePanel initialRun={latestPipelineRun} />

        <DcbestIngestPanel
          initial={{
            lastCrawledAt: dcbestSource?.lastCrawledAt?.toISOString() ?? null,
            lastCrawlStatus: dcbestSource?.lastCrawlStatus ?? null,
            lastCrawlMethod: dcbestSource?.lastCrawlMethod ?? null,
            lastCrawlDetail: dcbestSource?.lastCrawlDetail ?? null,
            rawDocumentCount: dcbestDocumentCount,
          }}
        />

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Primary Keywords</h2>
              <p className="mt-1 text-sm text-slate-600">
                수동 primary만 운영합니다. pinned primary는 최대 30개까지 유지합니다.
              </p>
            </div>
            <Link
              href="/admin/keywords?view=primary&sort=pinned&pinned=1"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-stone-50"
            >
              Open Inventory
            </Link>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <form action={createManualPrimaryKeywordAction} className="rounded-[24px] border border-black/10 bg-stone-50/70 p-4">
              <div className="text-sm font-semibold text-slate-900">Add One</div>
              <div className="mt-3 flex flex-wrap gap-3">
                <select
                  name="region"
                  defaultValue="KR"
                  className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900"
                >
                  <option value="KR">KR</option>
                  <option value="JP">JP</option>
                </select>
                <input type="hidden" name="language" value="ko" />
                <input
                  type="text"
                  name="text"
                  placeholder="예: 마사지 후기"
                  className="min-w-[220px] flex-1 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900"
                />
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Add Primary
                </button>
              </div>
            </form>

            <form action={bulkImportManualPrimaryKeywordsAction} className="rounded-[24px] border border-black/10 bg-stone-50/70 p-4">
              <div className="text-sm font-semibold text-slate-900">Bulk Import</div>
              <p className="mt-1 text-sm text-slate-600">
                `[한국]`, `[일본]` 블록 기준으로 한 줄에 하나씩 넣습니다.
              </p>
              <textarea
                name="bulkText"
                rows={6}
                placeholder={"[한국]\n마사지 후기\n팬트리 디시\n\n[일본]\nおすすめ"}
                className="mt-3 w-full rounded-[20px] border border-black/10 bg-white px-4 py-3 text-sm text-slate-900"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Import Primary Block
                </button>
              </div>
            </form>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {manualPrimaryKeywords.length > 0 ? (
              manualPrimaryKeywords.map((keyword) => (
                <article
                  key={keyword.id}
                  className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-950">{keyword.text}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {keyword.region} · {keyword.language} · pinned {keyword.pinned ? "yes" : "no"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={updateKeywordPinnedAction}>
                        <input type="hidden" name="keywordId" value={String(keyword.id)} />
                        <input type="hidden" name="pinned" value={keyword.pinned ? "0" : "1"} />
                        <button
                          type="submit"
                          className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-stone-100"
                        >
                          {keyword.pinned ? "Unpin" : "Pin"}
                        </button>
                      </form>
                      <form action={deleteManualPrimaryKeywordAction}>
                        <input type="hidden" name="keywordId" value={String(keyword.id)} />
                        <button
                          type="submit"
                          className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-stone-100"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/70 px-4 py-6 text-sm text-slate-500">
                등록된 manual primary가 없습니다.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Secondary Keywords</h2>
            <p className="mt-1 text-sm text-slate-600">
              Trends 확장 외에도 줄바꿈 기준 벌크 입력으로 secondary를 직접 추가할 수 있습니다.
            </p>
          </div>

          <form action={bulkImportManualSecondaryKeywordsAction} className="mt-5 rounded-[24px] border border-black/10 bg-stone-50/70 p-4">
            <div className="grid gap-3 md:grid-cols-[120px_120px_minmax(0,1fr)]">
              <select
                name="region"
                defaultValue="KR"
                className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900"
              >
                <option value="KR">KR</option>
                <option value="JP">JP</option>
              </select>
              <input type="hidden" name="language" value="ko" />
              <select
                name="parentKeywordId"
                defaultValue=""
                className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-900"
              >
                <option value="">No Parent</option>
                {manualPrimaryKeywords.map((keyword) => (
                  <option key={keyword.id} value={String(keyword.id)}>
                    {keyword.text}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              name="bulkText"
              rows={8}
              placeholder={"타이 마사지 후기\n스웨디시 추천\n팬트리 디시 링크"}
              className="mt-3 w-full rounded-[20px] border border-black/10 bg-white px-4 py-3 text-sm text-slate-900"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Import Secondary Block
              </button>
            </div>
          </form>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {recentSecondaryKeywords.map((keyword) => (
              <article
                key={keyword.id}
                className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4"
              >
                <div className="text-base font-semibold text-slate-950">{keyword.text}</div>
                <div className="mt-1 text-xs text-slate-500">
                  parent {keyword.parentKeyword?.text ?? "-"} · {keyword.sourceLabel ?? "-"} · score{" "}
                  {keyword.metrics[0]?.opportunityScore.toFixed(2) ?? "0.00"}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Namu Wiki Initial Pages</h2>
              <p className="mt-1 text-sm text-slate-600">
                `AV 배우 정보` 문서에서 실제 배우 이름을 읽어 `AV 배우 이름 초성 모음` 페이지로 정리합니다.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <NamuSyncAllButton />
              <Link
                href="/admin/keywords?view=generated"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-stone-50"
              >
                Generated Pages
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {NAMU_AV_ACTIVE_INITIALS.map((initial) => (
              <NamuSyncButton key={initial} initial={initial} />
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {namuPages.length > 0 ? (
              namuPages.map((page) => (
                <Link
                  key={page.id}
                  href={page.canonicalPath}
                  className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4 transition-colors hover:bg-white"
                >
                  <div className="text-base font-semibold text-slate-950">{page.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {page.canonicalPath} · {page.status}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{page.description}</p>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-stone-50/70 px-4 py-6 text-sm text-slate-500">
                아직 생성된 나무위키 초성 페이지가 없습니다.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight">Latest Secondary Preview</h2>
              <Link
                href="/admin/keywords?view=secondary"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-stone-50"
              >
                View All
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {recentSecondaryKeywords.slice(0, 10).map((keyword) => (
                <div
                  key={keyword.id}
                  className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-3"
                >
                  <div className="text-sm font-semibold text-slate-900">{keyword.text}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {keyword.parentKeyword?.text ?? "-"} · {keyword.sourceLabel ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight">Latest Page Preview</h2>
              <Link
                href="/admin/keywords?view=generated"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-stone-50"
              >
                View All
              </Link>
            </div>
            <div className="mt-5 grid gap-3">
              {generatedPages.slice(0, 10).map((page) => (
                <Link
                  key={page.id}
                  href={page.canonicalPath}
                  className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-3 transition-colors hover:bg-white"
                >
                  <div className="text-sm font-semibold text-slate-900">{page.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {page.status} · {page.keyword.text}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Publish Rules</h2>
              <p className="mt-1 text-sm text-slate-600">
                publish 실행 시 사용할 opportunity 기준 점수입니다.
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-black/8 bg-stone-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-950">
                  Minimum Publish Opportunity
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  현재 publish 기준: opportunity {publishRules.minRepresentativeOpportunity}+
                </div>
              </div>
              <form action={updatePublishThresholdAction} className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  name="minRepresentativeOpportunity"
                  min="0"
                  step="0.1"
                  defaultValue={publishRules.minRepresentativeOpportunity}
                  className="w-28 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-slate-900"
                />
                <button
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  type="submit"
                >
                  Save Threshold
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Traffic Redirect</h2>
              <p className="mt-1 text-sm text-slate-600">
                generated page 진입 시 외부 smartlink로 바로 넘길지 설정합니다.
              </p>
            </div>
          </div>
          <form action={updateTrafficRedirectSettingsAction} className="mt-5 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_160px]">
            <label className="flex items-center gap-3 rounded-2xl border border-black/10 bg-stone-50 px-4 py-3">
              <input
                type="checkbox"
                name="enabled"
                value="1"
                defaultChecked={trafficRedirectSettings.enabled}
              />
              <span className="text-sm font-medium text-slate-900">Enable Redirect</span>
            </label>
            <div className="flex items-center rounded-2xl border border-black/10 bg-stone-50 px-4 py-3 text-sm text-slate-700">
              {trafficRedirectSettings.smartlinkUrl}
            </div>
            <button
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              type="submit"
            >
              Save Redirect
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Ad Slots</h2>
              <p className="mt-1 text-sm text-slate-600">
                공개 페이지 광고 슬롯 on/off 토글입니다.
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
                        enabled ? "bg-sky-100 text-sky-900" : "bg-slate-200 text-slate-700"
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
      </div>
    </main>
  );
}
