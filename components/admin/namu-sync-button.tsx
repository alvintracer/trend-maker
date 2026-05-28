"use client";

import { useActionState } from "react";

import { syncNamuInitialPageAction } from "@/app/admin/namu-actions";

type SupportedInitial = "ㄱ" | "ㄴ" | "ㄷ" | "ㄹ" | "ㅁ";

export function NamuSyncButton({ initial }: { initial: SupportedInitial }) {
  const [state, formAction, isPending] = useActionState(syncNamuInitialPageAction, null);

  return (
    <form action={formAction} className="rounded-2xl border border-black/8 bg-stone-50/80 p-4">
      <input type="hidden" name="initial" value={initial} />
      <div className="text-lg font-semibold text-slate-950">{initial}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        클릭 시 해당 초성 구간을 다시 읽고 공개 페이지를 갱신합니다.
      </p>
      {state && !state.ok ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          동기화 완료
        </div>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isPending ? "동기화 중..." : `Sync ${initial}`}
      </button>
    </form>
  );
}
