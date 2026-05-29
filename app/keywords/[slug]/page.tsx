import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { GlobalAdScripts } from "@/components/ads/global-ad-scripts";
import { PublicAdSlot } from "@/components/ads/public-ad-slot";
import { getAdSlotSettingsMap } from "@/lib/ad-settings";
import {
  getGeneratedPageByRouteSlug,
  parseGeneratedPageArray,
} from "@/lib/generated-page-service";
import { getSiteUrl } from "@/lib/site-url";

const getCachedGeneratedPageBySlug = cache(async (slug: string) => getGeneratedPageByRouteSlug(slug));

type KeywordDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: KeywordDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCachedGeneratedPageBySlug(slug);

  if (!page) {
    return {};
  }

  const published = page.status === "published";
  const absoluteUrl = new URL(page.canonicalPath, getSiteUrl()).toString();

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: absoluteUrl,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: absoluteUrl,
      type: "article",
    },
    robots: {
      index: published,
      follow: published,
    },
  };
}

export default async function KeywordDetailPage({ params }: KeywordDetailPageProps) {
  const { slug } = await params;
  const [page, adSettings] = await Promise.all([
    getCachedGeneratedPageBySlug(slug),
    getAdSlotSettingsMap(),
  ]);

  if (!page) {
    notFound();
  }

  const latestAnalysis = page.keyword.analyses[0];
  const bodyParagraphs = parseGeneratedPageArray(page.faqRaw);
  const relatedKeywords = parseGeneratedPageArray(page.relatedKeywordsRaw);
  const childKeywords =
    page.keyword.level === "primary"
      ? page.keyword.childKeywords.filter((keyword) => keyword.level === "secondary")
      : page.keyword.childKeywords.filter((keyword) => keyword.level === "tertiary");
  const metric = page.keyword.metrics[0];
  const isPublished = page.status === "published";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f8f5ec_48%,#f7f7f4_100%)] text-slate-950">
      <GlobalAdScripts
        enabledKeys={[
          ...(adSettings.global_social_bar ? (["global_social_bar"] as const) : []),
          ...(adSettings.global_popunder ? (["global_popunder"] as const) : []),
        ]}
      />
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-8 xl:grid-cols-[190px_minmax(0,1fr)_320px] xl:px-6">
        <aside className="hidden xl:block">
          <PublicAdSlot
            slotKey="detail_left_rail"
            enabled={adSettings.detail_left_rail}
            surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/85 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur xl:sticky xl:top-6"
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex justify-center">
            <PublicAdSlot
              slotKey="detail_top_banner"
              enabled={adSettings.detail_top_banner}
              surfaceClassName="overflow-hidden rounded-[22px] border border-black/10 bg-white/90 px-3 py-3 shadow-[0_10px_32px_rgba(53,58,42,0.08)]"
            />
          </div>

        <section className="rounded-[28px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_80px_rgba(63,63,38,0.12)]">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-900">
            CommunityWikiKorea Page
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{page.h1}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{page.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip>{page.status}</Chip>
            <Chip>{page.keyword.level}</Chip>
            <Chip>opportunity {metric ? metric.opportunityScore.toFixed(2) : "0.00"}</Chip>
          </div>
          {!isPublished ? (
            <div className="mt-5 rounded-2xl border border-amber-900/10 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              This page is still under review. It is visible directly by URL but remains excluded
              from search indexing.
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)]">
            <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
            <div className="mt-5 rounded-2xl border border-black/8 bg-stone-50/80 p-4">
              <div className="text-lg font-semibold text-sky-800">{page.title}</div>
              <div className="mt-2 text-sm text-emerald-800">{page.canonicalPath}</div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{page.description}</p>
            </div>

            {latestAnalysis ? (
              <div className="mt-6 rounded-2xl border border-black/8 bg-white p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Topic Snapshot
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {latestAnalysis.intent || "Not set"}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {latestAnalysis.summary || "No analysis summary"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-6">
            <StatCard label="Last Generated" value={formatDate(page.lastGeneratedAt)} />
            <StatCard label="Body Blocks" value={String(bodyParagraphs.length)} />
            <StatCard label="Related Terms" value={String(relatedKeywords.length)} />
          </div>
        </section>

        <PublicAdSlot slotKey="detail_inline_native" enabled={adSettings.detail_inline_native} />

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)]">
          <h2 className="text-xl font-semibold tracking-tight">본문</h2>
          <div className="mt-4 grid gap-4">
            {bodyParagraphs.length > 0 ? (
              bodyParagraphs.map((paragraph, index) => (
                <div
                  key={`${paragraph}-${index}`}
                  className="rounded-2xl border border-black/8 bg-stone-50/80 px-5 py-4 text-sm leading-7 text-slate-800"
                >
                  {paragraph}
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">No body blocks generated yet.</div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)]">
            <h2 className="text-xl font-semibold tracking-tight">Related Keywords</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedKeywords.length > 0 ? (
                relatedKeywords.map((keyword, index) => <Chip key={`${keyword}-${index}`}>{keyword}</Chip>)
              ) : (
                <div className="text-sm text-slate-500">No related keywords</div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)]">
            <h2 className="text-xl font-semibold tracking-tight">Related Searches</h2>
              <div className="mt-4 grid gap-3">
              {childKeywords.length > 0 ? (
                childKeywords.map((keyword) => (
                  <div
                    key={keyword.id}
                    className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-slate-900">{keyword.text}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      opportunity {keyword.metrics[0]?.opportunityScore.toFixed(2) ?? "0.00"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">No related child keywords</div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)]">
          <h2 className="text-xl font-semibold tracking-tight">본문 포인트</h2>
          <div className="mt-4 grid gap-3">
            {bodyParagraphs.length > 0 ? (
              bodyParagraphs.slice(0, 4).map((question) => (
                <div
                  key={question}
                  className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-3 text-sm font-medium text-slate-800"
                >
                  {question}
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">No FAQ draft</div>
            )}
          </div>
        </section>

        <div className="flex justify-center">
          <PublicAdSlot
            slotKey="detail_bottom_banner"
            enabled={adSettings.detail_bottom_banner}
            surfaceClassName="overflow-hidden rounded-[22px] border border-black/10 bg-white/90 px-3 py-3 shadow-[0_10px_32px_rgba(53,58,42,0.08)]"
          />
        </div>
        </div>

        <aside className="hidden xl:block">
          <div className="flex flex-col gap-6 xl:sticky xl:top-6">
            <PublicAdSlot
              slotKey="detail_right_rail"
              enabled={adSettings.detail_right_rail}
              surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/85 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
            />
            <div className="rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-[0_16px_60px_rgba(53,58,42,0.08)]">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Quick Facts
              </div>
              <div className="mt-4 grid gap-3">
                <QuickFact label="상태" value={page.status} />
                <QuickFact label="레벨" value={page.keyword.level} />
                <QuickFact label="연관어" value={String(relatedKeywords.length)} />
                <QuickFact label="확장 키워드" value={String(childKeywords.length)} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
      {children}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-black/10 bg-white/85 p-5 shadow-[0_12px_40px_rgba(53,58,42,0.08)]">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}
