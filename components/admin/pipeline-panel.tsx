"use client";

import { useEffect, useRef, useState } from "react";

import type { PipelineStep } from "@/lib/pipeline-run";

type PipelineRunView = {
  id: number;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  cancelRequested: boolean;
  sourceIds: string[];
  steps: PipelineStep[];
  logs: Array<{
    timestamp: string | Date;
    level: "info" | "warn" | "error";
    message: string;
  }>;
  summary: {
    ingestedSources?: number;
    selectedPrimaryKeywords?: number;
    selectedSecondaryKeywords?: number;
    analyzedKeywords?: number;
    generatedPages?: number;
    publishedItems?: number;
  } | null;
  error: string | null;
  startedAt: string | Date;
  finishedAt: string | Date | null;
};

type PipelineRunRequestBody = {
  sourceIds?: string[];
  startFrom?: PipelineStep["id"];
  endAt?: PipelineStep["id"];
  skipIngest?: boolean;
  primarySelection?: "auto" | "manual";
  maxPrimaryKeywords?: number;
  publishEligible?: boolean;
  secondaryForceRefresh?: boolean;
  skipAnalysis?: boolean;
  skipHubs?: boolean;
};

async function fetchLatestRun() {
  const response = await fetch("/api/admin/pipeline-runs/latest", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch latest pipeline run");
  }

  const payload = (await response.json()) as { ok: boolean; run: PipelineRunView | null };
  return payload.run;
}

export function PipelinePanel({ initialRun }: { initialRun: PipelineRunView | null }) {
  const [run, setRun] = useState<PipelineRunView | null>(initialRun);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [maxPrimaryKeywords, setMaxPrimaryKeywords] = useState("30");
  const [includeIngest, setIncludeIngest] = useState(true);
  const [includePageGeneration, setIncludePageGeneration] = useState(true);
  const [includePublish, setIncludePublish] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (run?.status !== "running") {
      return;
    }

    startPolling();
    return stopPolling;
  }, [run?.id, run?.status]);

  function stopPolling() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();

    intervalRef.current = window.setInterval(async () => {
      const latestRun = await fetchLatestRun();
      setRun(latestRun);

      if (!latestRun || latestRun.status !== "running") {
        stopPolling();
        setIsSubmitting(false);
      }
    }, 2000);
  }

  async function mutateRun(action: "cancel" | "force-release") {
    if (!run) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/pipeline-runs/${run.id}/${action}`, {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      const latestRun = await fetchLatestRun();
      setRun(latestRun);

      if (!payload.ok) {
        setMessage(payload.error ?? "Pipeline action failed");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pipeline action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRun(body: PipelineRunRequestBody = {}) {
    setIsSubmitting(true);
    setMessage(null);
    startPolling();

    try {
      const response = await fetch("/api/run/full-pipeline", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      const latestRun = await fetchLatestRun();
      setRun(latestRun);

      if (!payload.ok) {
        setMessage(payload.error ?? "Pipeline execution failed");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pipeline execution failed");
    } finally {
      const latestRun = await fetchLatestRun().catch(() => null);

      if (latestRun) {
        setRun(latestRun);

        if (latestRun.status !== "running") {
          stopPolling();
          setIsSubmitting(false);
        }
      } else {
        stopPolling();
        setIsSubmitting(false);
      }
    }
  }

  function buildManualBatchRequest(forceRefresh = false): PipelineRunRequestBody {
    const parsedMaxPrimaryKeywords = Number(maxPrimaryKeywords);
    const maxPrimary =
      Number.isFinite(parsedMaxPrimaryKeywords) && parsedMaxPrimaryKeywords > 0
        ? parsedMaxPrimaryKeywords
        : 30;
    const endAt = includePublish ? "publish" : includePageGeneration ? "pages" : "secondary";

    return {
      sourceIds: includeIngest ? ["dcinside-dcbest"] : undefined,
      startFrom: includeIngest ? "ingest" : "primary",
      endAt,
      skipIngest: !includeIngest,
      primarySelection: "manual",
      maxPrimaryKeywords: maxPrimary,
      publishEligible: includePublish,
      secondaryForceRefresh: forceRefresh,
      skipAnalysis: true,
      skipHubs: true,
    };
  }

  function handleResume(stepId: PipelineStep["id"]) {
    return handleRun({
      ...buildManualBatchRequest(false),
      startFrom: stepId,
    });
  }

  return (
    <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Batch Control</h2>
          <p className="mt-1 text-sm text-slate-600">
            단계 체크 후 한 번에 돌리고, 진행 중이면 단계별 불빛과 콘솔로 상태를 봅니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-slate-700">
            <span>Max Primary</span>
            <input
              type="number"
              min="1"
              step="1"
              value={maxPrimaryKeywords}
              onChange={(event) => setMaxPrimaryKeywords(event.target.value)}
              className="w-16 bg-transparent text-right font-semibold text-slate-950 outline-none"
            />
          </label>
          <button
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            type="button"
            disabled={isSubmitting || run?.status === "running"}
            onClick={() => handleRun(buildManualBatchRequest(false))}
          >
            {run?.status === "running" || isSubmitting ? "Batch Running..." : "Run Selected Batch"}
          </button>
          <button
            className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-slate-400"
            type="button"
            disabled={isSubmitting || run?.status === "running"}
            onClick={() => handleRun(buildManualBatchRequest(true))}
          >
            Refresh Trends
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BatchToggle
          checked={includeIngest}
          label="DCBest Ingest"
          description="페이지 재료용 DCBest 수집 포함"
          onChange={setIncludeIngest}
        />
        <BatchToggle
          checked
          fixed
          label="Secondary Expansion"
          description="manual primary에서 Trends secondary 추출"
          onChange={() => undefined}
        />
        <BatchToggle
          checked={includePageGeneration}
          label="Page Generation"
          description="secondary + DCBest 재료로 공개 페이지 생성"
          onChange={(value) => {
            setIncludePageGeneration(value);
            if (!value) {
              setIncludePublish(false);
            }
          }}
        />
        <BatchToggle
          checked={includePublish}
          label="Publish"
          description="생성된 페이지를 바로 색인 가능 상태로 publish"
          onChange={setIncludePublish}
          disabled={!includePageGeneration}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ModeCard
          title="Resume"
          description="실패 시 해당 단계 카드의 Resume From Here로 이어서 다시 돌립니다."
        />
        <ModeCard
          title="Cancel"
          description="진행 중이면 cancel 또는 force release 후 다시 시작할 수 있습니다."
        />
        <ModeCard
          title="Preview"
          description="결과 미리보기는 아래 로그와 /admin/keywords 인벤토리에서 확인합니다."
        />
      </div>

      {run?.status === "running" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isSubmitting || run.cancelRequested}
            onClick={() => mutateRun("cancel")}
          >
            {run.cancelRequested ? "Cancel Requested" : "Request Cancel"}
          </button>
          <button
            className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isSubmitting}
            onClick={() => mutateRun("force-release")}
          >
            Force Release
          </button>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {message}
        </div>
      ) : null}

      {run ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <RunStat label="Run ID" value={`#${run.id}`} />
            <RunStat label="Status" value={run.status} />
            <RunStat label="Started" value={formatDate(run.startedAt)} />
          </div>

          {run.cancelRequested ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Cancel has been requested. The pipeline will stop at the next safe boundary.
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {run.steps.map((step, index) => (
              <article
                key={step.id}
                className="rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span
                      className={`h-3 w-3 rounded-full ${stepSignalClassName(step.status)}`}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="text-base font-semibold text-slate-950">{step.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{step.id}</div>
                    </div>
                  </div>
                  <span className={stepStatusClassName(step.status)}>{step.status}</span>
                </div>
                {step.summary ? (
                  <div className="mt-3 text-sm leading-6 text-slate-700">{step.summary}</div>
                ) : null}
                {step.error ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {step.error}
                  </div>
                ) : null}
                {run.status !== "running" && step.status !== "completed" ? (
                  <div className="mt-4">
                    <button
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-slate-400"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleResume(step.id)}
                    >
                      Resume From Here
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          {run.summary ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <RunStat label="Primary" value={String(run.summary.selectedPrimaryKeywords ?? 0)} />
              <RunStat
                label="Secondary"
                value={String(run.summary.selectedSecondaryKeywords ?? 0)}
              />
              <RunStat label="Analyzed" value={String(run.summary.analyzedKeywords ?? 0)} />
              <RunStat label="Pages" value={String(run.summary.generatedPages ?? 0)} />
              <RunStat label="Published" value={String(run.summary.publishedItems ?? 0)} />
              <RunStat label="Ingested" value={String(run.summary.ingestedSources ?? 0)} />
            </div>
          ) : null}

          <div className="mt-5 rounded-[24px] border border-black/10 bg-stone-50/80 p-4">
            <div className="text-sm font-semibold text-slate-900">Run Console</div>
            <div className="mt-3 max-h-72 overflow-auto rounded-2xl bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100">
              {run.logs.length > 0 ? (
                run.logs.map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="py-1">
                    <span className="text-slate-400">[{formatDateTime(entry.timestamp)}]</span>{" "}
                    <span
                      className={
                        entry.level === "error"
                          ? "text-rose-300"
                          : entry.level === "warn"
                            ? "text-amber-300"
                            : "text-emerald-300"
                      }
                    >
                      {entry.level.toUpperCase()}
                    </span>{" "}
                    <span>{entry.message}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-400">No logs yet.</div>
              )}
            </div>
          </div>

          {run.error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {run.error}
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-stone-50/70 px-4 py-6 text-sm text-slate-500">
          No pipeline run yet.
        </div>
      )}
    </section>
  );
}

function BatchToggle({
  checked,
  label,
  description,
  onChange,
  disabled = false,
  fixed = false,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  fixed?: boolean;
}) {
  return (
    <label
      className={`rounded-[22px] border p-4 transition-colors ${
        checked ? "border-emerald-300 bg-emerald-50/70" : "border-black/10 bg-stone-50/80"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled || fixed}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1"
        />
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          {fixed ? <div className="mt-2 text-xs text-slate-500">기본 필수 단계</div> : null}
        </div>
      </div>
    </label>
  );
}

function ModeCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-stone-50/80 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function RunStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-white/80 p-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function stepSignalClassName(status: PipelineStep["status"]) {
  if (status === "completed") {
    return "bg-emerald-500";
  }

  if (status === "running") {
    return "bg-sky-500";
  }

  if (status === "failed") {
    return "bg-rose-500";
  }

  if (status === "skipped") {
    return "bg-amber-500";
  }

  return "bg-slate-300";
}

function stepStatusClassName(status: PipelineStep["status"]) {
  const base = "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]";

  if (status === "completed") {
    return `${base} bg-emerald-100 text-emerald-900`;
  }

  if (status === "running") {
    return `${base} bg-sky-100 text-sky-900`;
  }

  if (status === "failed") {
    return `${base} bg-rose-100 text-rose-900`;
  }

  if (status === "skipped") {
    return `${base} bg-amber-100 text-amber-900`;
  }

  return `${base} bg-slate-200 text-slate-700`;
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}
