"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KANBAN_COLUMNS, PRIORITY_META } from "@/lib/config/kanban";
import { TaskCard } from "@/components/kanban/task-card";
import { MarkdownLite } from "@/components/agent/panels";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { KanbanBoard, KanbanTaskDetail, TaskStatus } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  ...Object.fromEntries(KANBAN_COLUMNS.map((c) => [c.status, c.color])),
  archived: "#6b7280",
};

function StatusDot({ status }: { status: TaskStatus }) {
  return <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[status] ?? "#6b7280" }} />;
}

/**
 * Live Hermes Kanban workspace: reads the active board over /api/hermes/kanban,
 * opens a task drawer (comments, links, runs, events) on card click, and polls a
 * cheap cursor (max task_events.id) to refetch only when the board changes. Used
 * standalone on /kanban and embedded in the Hermes agent workspace.
 */
export function HermesKanban({
  initialBoard,
  pollMs = 6000,
  boardHeightClass = "max-h-[60vh]",
  onOpenSession,
}: {
  initialBoard?: KanbanBoard;
  pollMs?: number;
  boardHeightClass?: string;
  /** Open a Hermes session (task.sessionId) — e.g. switch to the Chat tab. */
  onOpenSession?: (sessionId: string) => void;
}) {
  const [board, setBoard] = useState<KanbanBoard | null>(initialBoard ?? null);
  const [loading, setLoading] = useState(!initialBoard);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KanbanTaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const fetching = useRef(false);
  const cursorRef = useRef<number>(initialBoard?.cursor ?? -1);

  const loadBoard = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const res = await fetch("/api/hermes/kanban/board", { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as KanbanBoard;
        cursorRef.current = next.cursor;
        setBoard(next);
      }
    } catch {
      /* keep prior board */
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/hermes/kanban/tasks/${encodeURIComponent(id)}`, { cache: "no-store" });
      setDetail(res.ok ? ((await res.json()) as KanbanTaskDetail) : null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openTask = useCallback(
    (id: string) => {
      setSelectedId(id);
      setDetail(null);
      void loadDetail(id);
    },
    [loadDetail],
  );

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  // Initial load when not server-seeded (deferred a tick so the fetch's state
  // updates land outside the effect body).
  useEffect(() => {
    if (initialBoard) return;
    const t = setTimeout(() => void loadBoard(), 0);
    return () => clearTimeout(t);
  }, [initialBoard, loadBoard]);

  // Poll the cheap cursor; refetch the board only when it advances.
  useEffect(() => {
    if (pollMs <= 0) return;
    let stop = false;
    const handle = setInterval(async () => {
      try {
        const res = await fetch("/api/hermes/kanban/cursor", { cache: "no-store" });
        if (!res.ok || stop) return;
        const { cursor } = (await res.json()) as { cursor: number };
        if (cursor !== cursorRef.current) await loadBoard();
      } catch {
        /* offline tick — retry next interval */
      }
    }, pollMs);
    return () => {
      stop = true;
      clearInterval(handle);
    };
  }, [pollMs, loadBoard]);

  const tasks = board?.tasks ?? [];
  const byStatus = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (t.status === "archived") continue;
    if (!byStatus.has(t.status)) byStatus.set(t.status, []);
    byStatus.get(t.status)!.push(t);
  }
  for (const list of byStatus.values()) list.sort((a, b) => b.priority - a.priority);

  if (loading && !board) {
    return (
      <div className="flex h-48 items-center justify-center gap-2 text-faint">
        <Icon name="Loader" size={18} className="animate-spin" /> Loading board…
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={cn("flex gap-4 overflow-x-auto overflow-y-auto pb-3", boardHeightClass)}>
        {KANBAN_COLUMNS.map((col) => {
          const items = byStatus.get(col.status) ?? [];
          return (
            <section key={col.status} className="flex w-[280px] shrink-0 flex-col">
              <div className="sticky top-0 z-[1] mb-2 flex items-center gap-2 bg-surface/80 px-1 py-1 backdrop-blur">
                <span className="size-2 rounded-full" style={{ background: col.color }} />
                <h3 className="text-sm font-semibold text-ink">{col.label}</h3>
                <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-medium text-faint">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 rounded-xl border border-line/60 bg-surface/40 p-2">
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-faint/60">No tasks</p>
                ) : (
                  items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openTask(t.id)}
                      className={cn(
                        "block w-full text-left",
                        selectedId === t.id && "ring-1 ring-[var(--accent)]/50 rounded-lg",
                      )}
                    >
                      <TaskCard task={t} />
                    </button>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selectedId && (
        <TaskDrawer
          detail={detail}
          loading={detailLoading}
          onClose={closeDrawer}
          onOpenSession={onOpenSession}
        />
      )}
    </div>
  );
}

function TaskDrawer({
  detail,
  loading,
  onClose,
  onOpenSession,
}: {
  detail: KanbanTaskDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpenSession?: (sessionId: string) => void;
}) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-line bg-surface shadow-2xl">
        <div className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
          <span className="font-mono text-xs text-faint">{detail?.id ?? "…"}</span>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {loading || !detail ? (
          <div className="flex h-48 items-center justify-center gap-2 text-faint">
            <Icon name="Loader" size={18} className="animate-spin" /> Loading task…
          </div>
        ) : (
          <div className="space-y-5 px-5 py-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                  <StatusDot status={detail.status} /> {detail.status}
                </span>
                {PRIORITY_META[detail.priority] && (
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                      PRIORITY_META[detail.priority].className,
                    )}
                  >
                    {PRIORITY_META[detail.priority].label}
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold leading-snug text-ink">{detail.title}</h2>
            </div>

            <DrawerMeta detail={detail} onOpenSession={onOpenSession} />

            {detail.body && (
              <Section title="Description">
                <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface-2/50 p-3">
                  <MarkdownLite source={detail.body} />
                </div>
              </Section>
            )}

            {(detail.parents.length > 0 || detail.children.length > 0) && (
              <Section title="Links">
                {detail.parents.length > 0 && <LinkGroup label="Depends on" links={detail.parents} />}
                {detail.children.length > 0 && <LinkGroup label="Blocks" links={detail.children} />}
              </Section>
            )}

            {detail.lastFailureError && (
              <Section title="Last failure">
                <p className="rounded-lg border border-danger/25 bg-danger/10 p-3 font-mono text-xs text-danger">
                  {detail.lastFailureError}
                </p>
              </Section>
            )}

            {detail.runs.length > 0 && (
              <Section title={`Runs (${detail.runs.length})`}>
                <ul className="space-y-2">
                  {detail.runs.map((r) => (
                    <li key={r.id} className="rounded-lg border border-line bg-surface-2/50 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-medium text-muted">
                          {r.stepKey ?? r.profile ?? `run ${r.id}`}
                          {r.outcome && <RunOutcome outcome={r.outcome} />}
                          {!r.outcome && r.status && <span className="text-faint">{r.status}</span>}
                        </span>
                        <span className="shrink-0 text-faint">{r.duration ?? r.startedAt ?? ""}</span>
                      </div>
                      {r.summary && <p className="mt-1 text-faint">{r.summary}</p>}
                      {r.error && <p className="mt-1 font-mono text-danger">{r.error}</p>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {detail.events.length > 0 && (
              <Section title="Recent activity">
                <ul className="space-y-1.5">
                  {detail.events.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent)]">
                        {e.kind}
                      </span>
                      <span className="min-w-0 flex-1 text-faint">{e.summary ?? ""}</span>
                      <span className="shrink-0 text-faint/70">{e.createdAt}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {detail.comments.length > 0 && (
              <Section title={`Comments (${detail.comments.length})`}>
                <ul className="space-y-2.5">
                  {detail.comments.map((c) => (
                    <li key={c.id} className="rounded-lg border border-line bg-surface-2/50 p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between text-xs text-faint">
                        <span className="font-medium text-muted">{c.author ?? "unknown"}</span>
                        <span>{c.createdAt}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-muted">{c.body}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerMeta({
  detail,
  onOpenSession,
}: {
  detail: KanbanTaskDetail;
  onOpenSession?: (sessionId: string) => void;
}) {
  const rows: { label: string; value?: string }[] = [
    { label: "Assignee", value: detail.assignee },
    { label: "Created by", value: detail.createdBy },
    { label: "Created", value: detail.createdAt },
    { label: "Started", value: detail.startedAt },
    { label: "Completed", value: detail.completedAt },
    { label: "Branch", value: detail.branchName },
    { label: "Workspace", value: detail.workspaceKind },
    { label: "Path", value: detail.workspacePath },
    { label: "Model", value: detail.modelOverride },
    { label: "Step", value: detail.currentStepKey },
  ].filter((r) => r.value);

  return (
    <div className="divide-y divide-line rounded-lg border border-line">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-3 px-3 py-1.5 text-xs">
          <span className="shrink-0 text-faint">{r.label}</span>
          <span className="break-all text-right font-medium text-muted">{r.value}</span>
        </div>
      ))}
      {detail.sessionId && (
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
          <span className="shrink-0 text-faint">Session</span>
          {onOpenSession ? (
            <button
              onClick={() => onOpenSession(detail.sessionId!)}
              className="flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
            >
              <Icon name="MessageSquare" size={12} /> Open in Chat
            </button>
          ) : (
            <span className="break-all text-right font-mono text-muted">{detail.sessionId}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</h4>
      {children}
    </div>
  );
}

function LinkGroup({ label, links }: { label: string; links: KanbanTaskDetail["parents"] }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-xs text-faint">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {links.map((l) => (
          <span
            key={l.id}
            className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-muted"
            title={l.title}
          >
            <StatusDot status={l.status} />
            <span className="max-w-[200px] truncate">{l.title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function RunOutcome({ outcome }: { outcome: string }) {
  const ok = /success|complete|done|ok/i.test(outcome);
  const bad = /fail|error/i.test(outcome);
  return (
    <span className={cn("font-medium", ok ? "text-ok" : bad ? "text-danger" : "text-faint")}>{outcome}</span>
  );
}
