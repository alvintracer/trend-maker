import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { GlobalAdScripts } from "@/components/ads/global-ad-scripts";
import { PublicAdSlot } from "@/components/ads/public-ad-slot";
import { getAdSlotSettingsMap } from "@/lib/ad-settings";
import {
  getGeneratedPageByRouteSlug,
  parseGeneratedPageArray,
} from "@/lib/generated-page-service";
import { prisma } from "@/lib/prisma";
import { isSearchCrawlerUserAgent, toAbsoluteUrl } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";
import { getTrafficRedirectSettings } from "@/lib/traffic-redirect-settings";

const getCachedGeneratedPageBySlug = cache(async (slug: string) => getGeneratedPageByRouteSlug(slug));

type KeywordDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate = 60;

export async function generateMetadata({
  params,
}: KeywordDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCachedGeneratedPageBySlug(slug);

  if (!page) {
    const keywordIdMatch = slug.match(/^keyword-(\d+)$/);

    if (keywordIdMatch) {
      const legacyPage = await prisma.generatedPage.findFirst({
        where: { keywordId: Number(keywordIdMatch[1]) },
        include: {
          keyword: {
            include: {
              metrics: { orderBy: { metricDate: "desc" }, take: 1 },
            },
          },
        },
      });

      if (legacyPage) {
        const absoluteUrl = new URL(legacyPage.canonicalPath, getSiteUrl()).toString();
        const relatedKeywords = parseGeneratedPageArray(legacyPage.relatedKeywordsRaw).slice(0, 12);
        const keywordTerms = Array.from(
          new Set([legacyPage.h1, legacyPage.title, ...relatedKeywords].map((v) => v.trim()).filter(Boolean)),
        );
        const published = legacyPage.status === "published";

        return {
          title: legacyPage.title,
          description: legacyPage.description,
          alternates: { canonical: absoluteUrl },
          keywords: keywordTerms,
          openGraph: {
            title: legacyPage.title,
            description: legacyPage.description,
            url: absoluteUrl,
            type: "article",
            siteName: "CommunityWikiKorea",
            locale: "ko_KR",
            publishedTime: legacyPage.createdAt.toISOString(),
            modifiedTime: legacyPage.updatedAt.toISOString(),
          },
          twitter: {
            card: "summary_large_image",
            title: legacyPage.title,
            description: legacyPage.description,
          },
          robots: { index: published, follow: published },
        };
      }
    }

    return {};
  }

  const published = page.status === "published";
  const absoluteUrl = new URL(page.canonicalPath, getSiteUrl()).toString();
  const relatedKeywords = parseGeneratedPageArray(page.relatedKeywordsRaw).slice(0, 12);
  const keywordTerms = Array.from(
    new Set([page.h1, page.title, ...relatedKeywords].map((value) => value.trim()).filter(Boolean)),
  );

  const seoTitle = `${page.title} - 커뮤니티 실시간 반응 & 트렌드 | 커뮤니티위키코리아`;
  const seoDescription = `${page.description} | 커뮤니티위키코리아(컴코)에서 실시간 커뮤니티 트렌드를 확인하세요.`;

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: {
      canonical: absoluteUrl,
    },
    keywords: keywordTerms,
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: absoluteUrl,
      type: "article",
      siteName: "CommunityWikiKorea | 커뮤니티위키코리아",
      locale: "ko_KR",
      publishedTime: page.createdAt.toISOString(),
      modifiedTime: page.updatedAt.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description: seoDescription,
    },
    robots: {
      index: published,
      follow: published,
    },
  };
}

export default async function KeywordDetailPage({ params }: KeywordDetailPageProps) {
  const { slug } = await params;
  const [page, adSettings, trafficRedirectSettings, requestHeaders] = await Promise.all([
    getCachedGeneratedPageBySlug(slug),
    getAdSlotSettingsMap(),
    getTrafficRedirectSettings(),
    headers(),
  ]);

  if (!page) {
    const keywordIdMatch = slug.match(/^keyword-(\d+)$/);

    if (keywordIdMatch) {
      const legacyPage = await prisma.generatedPage.findFirst({
        where: { keywordId: Number(keywordIdMatch[1]) },
        select: { canonicalPath: true },
      });

      if (legacyPage) {
        redirect(legacyPage.canonicalPath);
      }
    }

    notFound();
  }

  if (
    page.status === "published" &&
    trafficRedirectSettings.enabled &&
    trafficRedirectSettings.smartlinkUrl &&
    !isSearchCrawlerUserAgent(requestHeaders.get("user-agent"))
  ) {
    redirect(trafficRedirectSettings.smartlinkUrl);
  }

  const latestAnalysis = page.keyword.analyses[0];
  const bodyParagraphs = parseGeneratedPageArray(page.faqRaw);
  const relatedKeywords = parseGeneratedPageArray(page.relatedKeywordsRaw);
  const childKeywords =
    page.keyword.level === "primary"
      ? page.keyword.childKeywords.filter((keyword) => keyword.level === "secondary")
      : page.keyword.childKeywords.filter((keyword) => keyword.level === "tertiary");
  const parentKeyword = page.keyword.parentKeyword;
  const parentHubPage = parentKeyword?.generatedPages?.[0] ?? null;
  const metric = page.keyword.metrics[0];
  const isPublished = page.status === "published";
  const siteUrl = getSiteUrl();
  const absoluteUrl = toAbsoluteUrl(page.canonicalPath, siteUrl);
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.h1,
            item: absoluteUrl,
          },
        ],
      },
      {
        "@type": "Article",
        headline: page.h1,
        name: page.title,
        description: page.description,
        url: absoluteUrl,
        inLanguage: "ko-KR",
        dateModified: page.updatedAt.toISOString(),
        datePublished: page.createdAt.toISOString(),
        mainEntityOfPage: absoluteUrl,
        keywords: [page.h1, ...relatedKeywords.slice(0, 10)],
      },
      {
        "@type": "ItemList",
        name: `${page.h1} 연관 키워드`,
        itemListElement: childKeywords.slice(0, 12).map((keyword, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: keyword.text,
          ...(keyword.generatedPages[0]
            ? {
                url: toAbsoluteUrl(keyword.generatedPages[0].canonicalPath, siteUrl),
              }
            : {}),
        })),
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0eafd_0%,#f1f5f9_45%,#f8fafc_100%)] text-slate-950">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      <GlobalAdScripts
        enabledKeys={[
          ...(adSettings.global_social_bar ? (["global_social_bar"] as const) : []),
          ...(adSettings.global_popunder ? (["global_popunder"] as const) : []),
        ]}
      />
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-8 xl:grid-cols-[190px_minmax(0,1fr)_320px] xl:px-6">
        <aside className="hidden xl:block">
          <div className="sticky top-6 flex flex-col gap-6">
            <PublicAdSlot
              slotKey="detail_left_rail"
              enabled={adSettings.detail_left_rail}
              surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/85 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
            />
            <PublicAdSlot
              slotKey="detail_left_rail"
              enabled={adSettings.detail_left_rail}
              surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/85 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
            />
          </div>
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
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-900">
              {parentHubPage ? (
                <>
                  <Link
                    href={parentHubPage.canonicalPath}
                    className="text-sky-600 transition-colors hover:text-sky-800"
                  >
                    {parentKeyword?.text}
                  </Link>
                  <span className="text-slate-400">/</span>
                  <span>{page.h1}</span>
                </>
              ) : (
                <span>CommunityWikiKorea</span>
              )}
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
              이 페이지는 아직 검토 중입니다. URL로 직접 접근 가능하지만, 검색 색인에서는 제외됩니다.
            </div>
          ) : null}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(30,41,59,0.06)]">
              <h2 className="text-xl font-semibold tracking-tight">{page.h1} 개요</h2>
            <div className="mt-5 rounded-2xl border border-black/8 bg-slate-50/80 p-4">
              <div className="text-lg font-semibold text-sky-800">{page.title}</div>
              <div className="mt-2 text-sm text-sky-700">{page.canonicalPath}</div>
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
            <h2 className="text-xl font-semibold tracking-tight">{page.h1} 본문</h2>
            <div className="mt-4 grid gap-4">
              {bodyParagraphs.length > 0 ? (
                bodyParagraphs.map((paragraph, index) => (
                  <div
                    key={`${paragraph}-${index}`}
                    className="rounded-2xl border border-black/8 bg-slate-50/80 px-5 py-4 text-sm leading-7 text-slate-800"
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
              <h2 className="text-xl font-semibold tracking-tight">{page.h1} 연관 키워드</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {relatedKeywords.length > 0 ? (
                  relatedKeywords.map((keyword, index) => <Chip key={`${keyword}-${index}`}>{keyword}</Chip>)
                ) : (
                  <div className="text-sm text-slate-500">No related keywords</div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)]">
              <h2 className="text-xl font-semibold tracking-tight">{page.h1} 관련 검색 흐름</h2>
              <div className="mt-4 grid gap-3">
              {childKeywords.length > 0 ? (
                childKeywords.map((keyword) => (
                  keyword.generatedPages[0] ? (
                    <Link
                      key={keyword.id}
                      href={keyword.generatedPages[0].canonicalPath}
                      className="rounded-2xl border border-black/8 bg-slate-50/80 px-4 py-3 transition-colors hover:bg-white"
                    >
                      <div className="text-sm font-semibold text-slate-900">{keyword.text}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        opportunity {keyword.metrics[0]?.opportunityScore.toFixed(2) ?? "0.00"}
                      </div>
                    </Link>
                  ) : (
                    <div
                      key={keyword.id}
                      className="rounded-2xl border border-black/8 bg-slate-50/80 px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-slate-900">{keyword.text}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        opportunity {keyword.metrics[0]?.opportunityScore.toFixed(2) ?? "0.00"}
                      </div>
                    </div>
                  )
                ))
              ) : (
                <div className="text-sm text-slate-500">No related child keywords</div>
              )}
            </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)]">
            <h2 className="text-xl font-semibold tracking-tight">{page.h1} 핵심 포인트</h2>
            <div className="mt-4 grid gap-3">
              {bodyParagraphs.length > 0 ? (
                bodyParagraphs.slice(0, 4).map((question) => (
                  <div
                    key={question}
                    className="rounded-2xl border border-black/8 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-800"
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
            <PublicAdSlot
              slotKey="detail_right_rail"
              enabled={adSettings.detail_right_rail}
              surfaceClassName="overflow-hidden rounded-[28px] border border-black/10 bg-white/85 p-4 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
            />
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
    <div className="rounded-2xl border border-black/8 bg-slate-50/80 px-4 py-3">
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
