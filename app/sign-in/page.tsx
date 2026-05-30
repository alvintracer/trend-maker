import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign In",
  description: "CommunityWikiKorea 로그인 안내",
};

export default function SignInPage() {
  return (
    <main className="min-h-[60vh] bg-[radial-gradient(circle_at_top,#e0eafd_0%,#f1f5f9_42%,#f8fafc_100%)] px-4 py-10 text-slate-950 lg:px-6">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-black/10 bg-white/88 p-8 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
        <span className="rounded-full border border-black/10 bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
          Sign In
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">로그인 기능 준비 중</h1>
        <p className="mt-4 text-base leading-7 text-slate-700">
          현재 공개 사이트는 읽기 중심으로 운영되고 있으며 사용자 계정 기능은 아직 열려 있지
          않습니다. 향후 관리 기능 또는 개인화 기능이 필요해지면 로그인 플로우를 이 경로에
          연결합니다.
        </p>
        <div className="mt-6">
          <Link
            href="/admin"
            className="rounded-full border border-black/10 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            운영 화면으로 이동
          </Link>
        </div>
      </div>
    </main>
  );
}
