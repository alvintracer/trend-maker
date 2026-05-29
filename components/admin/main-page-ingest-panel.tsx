"use client";

import { useState } from "react";

type SourceStatus = {
  externalId: string;
  name: string;
  rawDocumentCount: number;
  lastCrawledAt: string | null;
  lastCrawlStatus: string | null;
  lastCrawlMethod: string | null;
  lastCrawlDetail: string | null;
  enabled: boolean;
  intervalHours: number;
};

type MainPageIngestPanelProps = {
  initialSources: SourceStatus[];
};

type IngestResponse = {
  ok: boolean;
  results?: Array<{
    source: {
      externalId: string;
    };
    fetchedCount: number;
    storedCount: number;
    method: string;
    detail?: string | null;
  }>;
  error?: string;
};

export function MainPageIngestPanel({ initialSources }: MainPageIngestPanelProps) {
  const [isRunning, setIsRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sources, setSources] = useState(initialSources);
  const [logs, setLogs] = useState<string[]>([
    ...initialSources.map(
      (source) =>
        `${source.externalId} docs=${source.rawDocumentCount} status=${source.lastCrawlStatus ?? "idle"} method=${source.lastCrawlMethod ?? "-"}`,
    ),
  ]);

  async function runRefresh(sourceExternalId?: string) {
    setIsRunning(sourceExternalId ?? "all");
    setMessage(null);
    setLogs((current) => [
      ...current,
      sourceExternalId
        ? `Starting source refresh ${sourceExternalId}`
        : "Starting main page source refresh",
    ]);

    try {
      const response = await fetch("/api/admin/main-page-sources", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(
          sourceExternalId
            ? {
                sourceExternalId,
              }
            : {},
        ),
      });
      const payload = (await response.json()) as IngestResponse;

      if (!response.ok || !payload.ok || !payload.results) {
        throw new Error(payload.error ?? "Main page source refresh failed");
      }
      const results = payload.results;

      setSources((current) =>
        current.map((item) => {
          const result = results.find((entry) => entry.source.externalId === item.externalId);

          if (!result) {
            return item;
          }

          return {
            ...item,
            rawDocumentCount: item.rawDocumentCount + result.storedCount,
            lastCrawledAt: new Date().toISOString(),
            lastCrawlStatus: "success",
            lastCrawlMethod: result.method ?? item.lastCrawlMethod,
            lastCrawlDetail: result.detail ?? item.lastCrawlDetail,
          };
        }),
      );
      setLogs((current) => [
        ...current,
        ...results.map(
          (result) =>
            `Completed ${result.source.externalId} fetched=${result.fetchedCount} stored=${result.storedCount} method=${result.method}`,
        ),
      ]);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Main page ingest failed";
      setMessage(nextMessage);
      setLogs((current) => [...current, `Error: ${nextMessage}`]);
    } finally {
      setIsRunning(null);
    }
  }

  async function updateSettings(sourceExternalId: string, enabled: boolean, intervalHours: number) {
    setMessage(null);

    try {
      const response = await fetch("/api/admin/main-page-sources", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceExternalId,
          enabled,
          intervalHours,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Settings update failed");
      }

      setSources((current) =>
        current.map((source) =>
          source.externalId === sourceExternalId
            ? {
                ...source,
                enabled,
                intervalHours,
              }
            : source,
        ),
      );
      setLogs((current) => [
        ...current,
        `Updated ${sourceExternalId} enabled=${enabled ? "1" : "0"} interval=${intervalHours}h`,
      ]);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Settings update failed";
      setMessage(nextMessage);
      setLogs((current) => [...current, `Error: ${nextMessage}`]);
    }
  }

  return (
    <section className="rounded-[28px] border border-black/10 bg-white/85 p-6 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Main Page Enhancement</h2>
          <p className="mt-1 text-sm text-slate-600">
            메인페이지에 노출할 커뮤니티 인기 게시글 재료만 별도로 수집합니다. 키워드 생성
            파이프라인과는 분리된 흐름입니다.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            현재 Vercel Hobby 플랜 기준으로 자동 갱신은 하루 1회만 지원합니다. 더 자주 갱신하려면
            아래 `Fetch` 버튼으로 수동 실행해야 합니다.
          </p>
        </div>
        <button
          type="button"
          disabled={Boolean(isRunning)}
          onClick={() => runRefresh()}
          className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isRunning === "all" ? "Refreshing..." : "Refresh Main Page Sources"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {sources.map((source) => (
          <article
            key={source.externalId}
            className="rounded-[24px] border border-black/10 bg-stone-50/80 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-950">{source.name}</div>
                <div className="mt-1 text-xs text-slate-500">{source.externalId}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  docs {source.rawDocumentCount}
                </span>
                <button
                  type="button"
                  disabled={Boolean(isRunning)}
                  onClick={() => runRefresh(source.externalId)}
                  className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isRunning === source.externalId ? "Fetching..." : "Fetch"}
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Status" value={source.lastCrawlStatus ?? "idle"} />
              <Stat label="Method" value={source.lastCrawlMethod ?? "-"} />
              <Stat label="Last Run" value={formatDate(source.lastCrawledAt)} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-center">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={(event) =>
                    updateSettings(source.externalId, event.target.checked, source.intervalHours)
                  }
                  className="h-4 w-4 rounded border-black/20"
                />
                Auto Fetch
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <span>Every</span>
                <input
                  type="number"
                  min={24}
                  max={24}
                  value={source.intervalHours}
                  onChange={() => {
                    setSources((current) =>
                      current.map((item) =>
                        item.externalId === source.externalId
                          ? {
                              ...item,
                              intervalHours: 24,
                            }
                          : item,
                      ),
                    );
                  }}
                  disabled
                  className="w-20 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <span>hours</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  updateSettings(source.externalId, source.enabled, source.intervalHours)
                }
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-stone-100"
              >
                Save
              </button>
            </div>
            {source.lastCrawlDetail ? (
              <div className="mt-3 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-slate-700">
                {source.lastCrawlDetail}
              </div>
            ) : null}
          </article>
        ))}
      </div>

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
    <div className="rounded-[18px] border border-black/10 bg-white/90 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
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
