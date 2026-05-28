import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "CommunityWikiKorea 개인정보처리방침",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[radial-gradient(circle_at_top,#f0f7e8_0%,#f5f1e8_42%,#f7f6f2_100%)] px-4 py-10 text-slate-950 lg:px-6">
      <article className="mx-auto max-w-4xl rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
        <span className="rounded-full border border-black/10 bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
          Privacy Policy
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">개인정보처리방침</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          최종 업데이트: 2026년 5월 27일
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700 sm:text-base">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">1. 수집하는 정보</h2>
            <p className="mt-2">
              CommunityWikiKorea는 공개 커뮤니티 트렌드 탐색 서비스를 운영하기 위해 서비스
              이용 중 발생하는 기본적인 접속 정보, 브라우저 정보, 기기 정보, 방문 로그 및
              광고/분석 도구를 통한 비식별 통계를 수집할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">2. 정보의 이용 목적</h2>
            <p className="mt-2">
              수집된 정보는 서비스 안정성 유지, 트래픽 분석, 부정 이용 방지, 광고 성과 측정,
              사이트 기능 개선 및 운영 공지 제공을 위해 사용됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">3. 쿠키 및 유사 기술</h2>
            <p className="mt-2">
              본 사이트는 방문자 환경을 기억하거나 광고 표시를 최적화하기 위해 쿠키, 로컬
              스토리지 또는 유사 기술을 사용할 수 있습니다. 사용자는 브라우저 설정을 통해 이를
              제한하거나 삭제할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">4. 제3자 제공 및 처리 위탁</h2>
            <p className="mt-2">
              본 사이트는 호스팅, 트래픽 분석, 광고 운영과 관련하여 제3자 서비스 제공자를 사용할
              수 있습니다. 이 경우 필요한 범위 내에서만 정보가 처리되며, 관련 법령에 따라
              관리됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">5. 보관 기간</h2>
            <p className="mt-2">
              수집된 정보는 처리 목적 달성 시까지 또는 관련 법령에서 요구하는 기간 동안만
              보관되며, 이후 지체 없이 파기 또는 비식별화됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">6. 이용자 권리</h2>
            <p className="mt-2">
              이용자는 관련 법령이 허용하는 범위 내에서 자신의 정보에 대한 열람, 정정, 삭제,
              처리 제한 요청을 할 수 있습니다. 실제 계정 기반 서비스가 도입되는 경우 관련 절차를
              별도로 고지합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">7. 정책 변경</h2>
            <p className="mt-2">
              본 방침은 서비스 운영 방식, 법령 또는 제3자 도구 변경에 따라 수정될 수 있으며,
              중요한 변경 시 본 페이지를 통해 업데이트됩니다.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
