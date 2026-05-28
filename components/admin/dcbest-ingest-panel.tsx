"use client";

import { useState } from "react";

type DcbestIngestPanelProps = {
  initial: {
    lastCrawledAt: string | null;
    lastCrawlStatus: string | null;
    lastCrawlMethod: string | null;
    lastCrawlDetail: string | null;
    rawDocumentCount: number;
  };
};

type IngestResponse = {
  ok: boolean;
  fetchedCount?: number;
  storedCount?: number;
  method?: string;
  detail?: string | null;
  error?: string;
};

export function DcbestIngestPanel({ initial }: DcbestIngestPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(initial);
  const [logs, setLogs] = useState<string[]>([
    `docs=${initial.rawDocumentCount} status=${initial.lastCrawlStatus ?? "idle"} method=${initial.lastCrawlMethod ?? "-"}`,
  ]);

  async function runIngest() {
    setIsRunning(true);
    setMessage(null);
    setLogs((current) => [...current, "Starting Playwright/browser ingest for DCBest pages 1-5"]);

    try {
      const response = await fetch("/api/ingest/dcinside-dcbest", {
        method: "POST",
      });
      const payload = (await response.json()) as IngestResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "DCBest ingest failed");
      }

      setStatus((current) => ({
        ...current,
        lastCrawledAt: new Date().toISOString(),
        lastCrawlStatus: "success",
        lastCrawlMethod: payload.method ?? current.lastCrawlMethod,
        lastCrawlDetail: payload.detail ?? current.lastCrawlDetail,
        rawDocumentCount: current.rawDocumentCount + (payload.storedCount ?? 0),
      }));
      setLogs((current) => [
        ...current,
        `Completed fetched=${payload.fetchedCount ?? 0} stored=${payload.storedCount ?? 0} method=${payload.method ?? "-"}`,
      ]);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "DCBest ingest failed";
      setMessage(nextMessage);
      setLogs((current) => [...current, `Error: ${nextMessage}`]);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">DCBest Page Materials</h2>
          <p className="mt-1 text-sm text-slate-600">
            디시 실시간베스트 1-5페이지를 브라우저 기반으로 수집해서 페이지 본문 재료로 저장합니다.
          </p>
        </div>
        <button
          type="button"
          disabled={isRunning}
          onClick={runIngest}
          className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isRunning ? "Ingest Running..." : "Ingest DCBest 1-5"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Stored Docs" value={String(status.rawDocumentCount)} />
        <Stat label="Last Status" value={status.lastCrawlStatus ?? "idle"} />
        <Stat label="Method" value={status.lastCrawlMethod ?? "-"} />
        <Stat label="Last Run" value={formatDate(status.lastCrawledAt)} />
      </div>

      {status.lastCrawlDetail ? (
        <div className="mt-4 rounded-2xl border border-black/8 bg-stone-50/80 px-4 py-3 text-sm text-slate-700">
          {status.lastCrawlDetail}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {message}
        </div>
      ) : null}

      <div className="mt-4 rounded-[24px] border border-black/10 bg-stone-50/80 p-4">
        <div className="text-sm font-semibold text-slate-900">Console</div>
        <div className="mt-3 max-h-56 overflow-auto rounded-2xl bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100">
          {logs.map((entry, index) => (
            <div key={`${entry}-${index}`} className="py-1">
              {entry}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-white/80 p-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
