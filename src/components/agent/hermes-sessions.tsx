"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Terminal } from "@/components/agent/terminal";
import { cn } from "@/lib/utils";
import type { HermesSessionRow, SessionDetail } from "@/lib/types";

const PAGE = 40;

interface SessionsResponse {
  sessions: HermesSessionRow[];
  total: number;
  offset: number;
  hasMore: boolean;
  available: boolean;
  reason?: string;
}

/**
 * Hermes Sessions browser: profile-aware chat history with FTS search,
 * pagination, an inline transcript drilldown, and "Resume in Chat" (which hands
 * the latest descendant session id back to the workspace's live PTY).
 */
export function HermesSessions({ onResume }: { onResume?: (sessionId: string) => void }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<HermesSessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [reason, setReason] = useState<string | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const reqId = useRef(0);

  // Debounce the search input.
  useEffect(() => {
    const h = setTimeout(() => {
      setQuery(input.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(h);
  }, [input]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (query) params.set("q", query);
      const res = await fetch(`/api/hermes/sessions?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as SessionsResponse;
      if (id !== reqId.current) return; // a newer request won
      setRows(data.sessions ?? []);
      setTotal(data.total ?? 0);
      setAvailable(data.available !== false);
      setReason(data.reason);
    } catch {
      if (id === reqId.current) {
        setRows([]);
        setTotal(0);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [query, offset]);

  // Deferred a tick so the fetch's state updates land outside the effect body.
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = useCallback(
    async (sessionId: string) => {
      if (expandedId === sessionId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(sessionId);
      setDetail(null);
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/hermes/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        setDetail(res.ok ? ((await res.json()) as SessionDetail) : null);
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedId],
  );

  if (!available) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-faint">
        <Icon name="Database" size={24} />
        <p className="text-sm">Hermes session history is unavailable.</p>
        {reason && <p className="text-xs text-faint/70">{reason}</p>}
      </div>
    );
  }

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-3">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm">
        <Icon name="Search" size={15} className="text-faint" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search message history…"
          className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none"
        />
        {input && (
          <button onClick={() => setInput("")} className="text-faint hover:text-ink" aria-label="Clear search">
            <Icon name="X" size={14} />
          </button>
        )}
      </label>

      <div className="flex items-center justify-between text-xs text-faint">
        <span>
          {loading ? "Searching…" : `${total.toLocaleString()} session${total === 1 ? "" : "s"}`}
          {query && !loading ? ` matching “${query}”` : ""}
        </span>
        {total > PAGE && (
          <span className="flex items-center gap-1">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
              className="grid size-6 place-items-center rounded-md border border-line disabled:opacity-40 hover:bg-surface-2"
              aria-label="Previous page"
            >
              <Icon name="ChevronLeft" size={14} />
            </button>
            <span className="tabular-nums">
              {page}/{pages}
            </span>
            <button
              disabled={offset + PAGE >= total}
              onClick={() => setOffset((o) => o + PAGE)}
              className="grid size-6 place-items-center rounded-md border border-line disabled:opacity-40 hover:bg-surface-2"
              aria-label="Next page"
            >
              <Icon name="ChevronRight" size={14} />
            </button>
          </span>
        )}
      </div>

      <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
        {rows.length === 0 && !loading ? (
          <p className="px-1 py-8 text-center text-sm text-faint">No sessions found.</p>
        ) : (
          rows.map((s) => {
            const open = expandedId === s.id;
            return (
              <div key={s.id} className="rounded-lg border border-line bg-surface-2/40">
                <button
                  onClick={() => toggle(s.id)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-2/70"
                >
                  <Icon
                    name="ChevronRight"
                    size={14}
                    className={cn("mt-0.5 shrink-0 text-faint transition-transform", open && "rotate-90")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="line-clamp-1 text-sm font-medium text-ink">{s.title}</span>
                      {s.status === "active" && (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-ok">
                          <span className="size-1.5 animate-pulse rounded-full bg-ok" /> live
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-faint">
                      {s.source && <SourceChip source={s.source} />}
                      {s.model && <span className="font-mono">{s.model}</span>}
                      <span className="flex items-center gap-1">
                        <Icon name="MessageSquare" size={11} /> {s.messageCount ?? 0}
                      </span>
                      {(s.toolCallCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Icon name="Wrench" size={11} /> {s.toolCallCount}
                        </span>
                      )}
                      <span>{s.updatedAt}</span>
                    </div>
                  </div>
                  {onResume && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onResume(s.id);
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-medium text-[var(--accent)] hover:opacity-90"
                    >
                      <Icon name="Play" size={11} /> Resume
                    </button>
                  )}
                </button>

                {open && (
                  <div className="border-t border-line px-3 py-3">
                    {detailLoading || !detail ? (
                      <div className="flex h-24 items-center justify-center gap-2 text-faint">
                        <Icon name="Loader" size={16} className="animate-spin" /> Loading transcript…
                      </div>
                    ) : (
                      <>
                        <Terminal
                          transcript={detail.transcript}
                          prompt={`hermes@${detail.workspace ?? "session"}:~$`}
                          heightClass="h-[320px]"
                        />
                        {onResume && (
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => onResume(detail.resumeId ?? detail.id)}
                              className="flex items-center gap-1.5 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:opacity-90"
                            >
                              <Icon name="Play" size={12} /> Resume in Chat
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const SOURCE_TONE: Record<string, string> = {
  cron: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  cli: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  discord: "text-indigo-400 border-indigo-400/30 bg-indigo-400/10",
  tui: "text-violet-400 border-violet-400/30 bg-violet-400/10",
  webhook: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

function SourceChip({ source }: { source: string }) {
  const tone = SOURCE_TONE[source] ?? "text-muted border-line bg-surface-3";
  return <span className={cn("rounded border px-1.5 py-0.5 font-medium", tone)}>{source}</span>;
}
