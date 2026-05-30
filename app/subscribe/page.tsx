import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subscribe",
  description: "CommunityWikiKorea 구독 안내",
};

export default function SubscribePage() {
  return (
    <main className="min-h-[60vh] bg-[radial-gradient(circle_at_top,#e0eafd_0%,#f1f5f9_42%,#f8fafc_100%)] px-4 py-10 text-slate-950 lg:px-6">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-black/10 bg-white/88 p-8 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
        <span className="rounded-full border border-black/10 bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
          Subscribe
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">구독 기능 준비 중</h1>
        <p className="mt-4 text-base leading-7 text-slate-700">
          이메일 또는 알림 기반 구독 기능은 아직 연결되지 않았습니다. 추후 주요 트렌드 허브와
          신규 문서 발행 소식을 구독할 수 있도록 확장할 예정입니다.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="rounded-full border border-black/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
