"use client";

import { useActionState } from "react";

import { syncAllNamuInitialPagesAction } from "@/app/admin/namu-actions";

export function NamuSyncAllButton() {
  const [state, formAction, isPending] = useActionState(syncAllNamuInitialPagesAction, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      {state && !state.ok ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          전체 동기화 완료
        </div>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isPending ? "전체 동기화 중..." : "Sync All Initials"}
      </button>
    </form>
  );
}
