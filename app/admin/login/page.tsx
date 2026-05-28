import type { Metadata } from "next";

import { loginAdminAction } from "@/app/admin/auth-actions";
import { ADMIN_PASSWORD_ENV, isAdminPasswordConfigured } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminLoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/admin";
  const configured = isAdminPasswordConfigured();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ecf3e7_0%,#f5f1e8_44%,#f7f6f2_100%)] px-6 py-16 text-slate-950">
      <div className="mx-auto max-w-xl rounded-[32px] border border-black/10 bg-white/90 p-8 shadow-[0_24px_80px_rgba(63,63,38,0.12)]">
        <div className="rounded-full border border-emerald-900/15 bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">
          Admin Access
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight">CommunityWikiKorea admin</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          운영 페이지는 비밀번호 입력 후에만 접근할 수 있습니다.
        </p>

        {!configured ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            서버 환경변수 <code>{ADMIN_PASSWORD_ENV}</code> 가 아직 설정되지 않았습니다.
          </div>
        ) : null}

        {params.error === "invalid" ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-800">
            비밀번호가 올바르지 않습니다.
          </div>
        ) : null}

        {params.error === "missing-password" ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-800">
            관리자 비밀번호가 서버에 설정되지 않아 로그인할 수 없습니다.
          </div>
        ) : null}

        <form action={loginAdminAction} className="mt-8 grid gap-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">Password</span>
            <input
              type="password"
              name="password"
              className="h-12 rounded-2xl border border-black/10 bg-stone-50 px-4 text-sm text-slate-950 outline-none transition-colors focus:border-slate-400"
              placeholder="Enter admin password"
              autoComplete="current-password"
              disabled={!configured}
            />
          </label>
          <button
            type="submit"
            disabled={!configured}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}
