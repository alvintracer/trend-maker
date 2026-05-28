import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "CommunityWikiKorea 이용약관",
};

export default function TermsOfUsePage() {
  return (
    <main className="bg-[radial-gradient(circle_at_top,#f0f7e8_0%,#f5f1e8_42%,#f7f6f2_100%)] px-4 py-10 text-slate-950 lg:px-6">
      <article className="mx-auto max-w-4xl rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
        <span className="rounded-full border border-black/10 bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
          Terms of Use
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">이용약관</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          최종 업데이트: 2026년 5월 27일
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700 sm:text-base">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">1. 서비스 목적</h2>
            <p className="mt-2">
              CommunityWikiKorea는 한국 온라인 커뮤니티의 실시간 트렌드 키워드 및 관련 허브
              정보를 탐색할 수 있도록 제공되는 정보성 서비스입니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">2. 이용자의 책임</h2>
            <p className="mt-2">
              이용자는 본 서비스를 법령 및 공공질서에 반하지 않는 범위에서 사용해야 하며,
              서비스의 정상 운영을 방해하거나 시스템 접근을 시도해서는 안 됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">3. 콘텐츠와 링크</h2>
            <p className="mt-2">
              본 사이트는 외부 커뮤니티나 외부 문서로 연결되는 링크를 포함할 수 있으며, 해당
              외부 사이트의 내용, 정책, 정확성에 대해 직접적인 책임을 지지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">4. 서비스 변경 및 중단</h2>
            <p className="mt-2">
              운영자는 서비스 품질 개선, 시스템 점검, 법적 요구 또는 운영상 필요에 따라 서비스의
              일부 또는 전부를 변경, 제한 또는 중단할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">5. 면책</h2>
            <p className="mt-2">
              본 서비스에 표시되는 트렌드, 키워드, 요약, 허브 정보는 자동 수집 또는 자동 생성
              과정을 포함할 수 있으므로 완전성, 정확성, 최신성을 보장하지 않습니다. 이용자는
              중요한 판단 전에 원문 출처를 직접 확인해야 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">6. 지적재산권</h2>
            <p className="mt-2">
              본 사이트의 고유한 디자인, 구성, 데이터 가공물 및 운영 산출물에 관한 권리는
              별도의 표시가 없는 한 CommunityWikiKorea 또는 정당한 권리자에게 귀속됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">7. 약관 변경</h2>
            <p className="mt-2">
              본 약관은 운영 정책 또는 관련 법령의 변경에 따라 수정될 수 있으며, 변경 사항은 본
              페이지에 반영된 시점부터 효력을 가집니다.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
