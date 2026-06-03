"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KANBAN_COLUMNS, PRIORITY_META } from "@/lib/config/kanban";
import { TaskCard } from "@/components/kanban/task-card";
import { MarkdownLite } from "@/components/agent/panels";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { KanbanBoard, KanbanTask, KanbanTaskDetail, TaskStatus } from "@/lib/types";

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
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState("");
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

  // POST a mutation, surface the CLI message, then refresh board + open task.
  const mutate = useCallback(
    async (url: string, body?: unknown): Promise<{ ok: boolean; message?: string; detail?: string }> => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = (await res.json().catch(() => ({ ok: res.ok }))) as { ok?: boolean; message?: string; detail?: string };
        const ok = data.ok ?? res.ok;
        setToast({ ok, text: [data.message || (ok ? "Done" : "Failed"), data.detail].filter(Boolean).join(" — ") });
        await loadBoard();
        setSelectedId((cur) => {
          if (cur) void loadDetail(cur);
          return cur;
        });
        return { ok, message: data.message, detail: data.detail };
      } catch {
        setToast({ ok: false, text: "Request failed" });
        return { ok: false };
      }
    },
    [loadBoard, loadDetail],
  );

  const mutateTask = useCallback(
    (taskId: string, body: unknown) => mutate(`/api/hermes/kanban/tasks/${encodeURIComponent(taskId)}`, body),
    [mutate],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bulkAction = useCallback(
    async (action: string) => {
      const ids = [...selected];
      if (ids.length === 0 || !bulkNote.trim()) return;
      const r = await mutate("/api/hermes/kanban/bulk", { action, ids, note: bulkNote.trim() });
      if (r.ok) {
        setSelected(new Set());
        setBulkNote("");
      }
    },
    [selected, bulkNote, mutate],
  );

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

  const allTasks = board?.tasks ?? [];
  const assignees = [...new Set(allTasks.map((t) => t.assignee).filter((a): a is string => !!a))].sort();

  const q = query.trim().toLowerCase();
  const matches = (t: KanbanTask) => {
    if (assigneeFilter === "__unassigned__" && t.assignee) return false;
    if (assigneeFilter !== "all" && assigneeFilter !== "__unassigned__" && t.assignee !== assigneeFilter) return false;
    if (!q) return true;
    const hay = `${t.id} ${t.title} ${t.assignee ?? ""} ${(t.skills ?? []).join(" ")} ${t.body ?? ""}`.toLowerCase();
    return hay.includes(q);
  };
  const filterActive = q !== "" || assigneeFilter !== "all";

  const byStatus = new Map<string, KanbanTask[]>();
  for (const t of allTasks) {
    if (t.status === "archived" || !matches(t)) continue;
    if (!byStatus.has(t.status)) byStatus.set(t.status, []);
    byStatus.get(t.status)!.push(t);
  }
  for (const list of byStatus.values()) list.sort((a, b) => b.priority - a.priority);
  const shownCount = [...byStatus.values()].reduce((n, l) => n + l.length, 0);

  const writesEnabled = !!board?.writesEnabled;

  if (loading && !board) {
    return (
      <div className="flex h-48 items-center justify-center gap-2 text-faint">
        <Icon name="Loader" size={18} className="animate-spin" /> Loading board…
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-8 min-w-[180px] flex-1 items-center gap-2 rounded-md border border-line bg-surface-2 px-2 text-xs">
            <Icon name="Search" size={13} className="text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tasks…"
              className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-faint hover:text-ink" aria-label="Clear filter">
                <Icon name="X" size={12} />
              </button>
            )}
          </label>
          {assignees.length > 0 && (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="h-8 rounded-md border border-line bg-surface-2 px-2 text-xs text-muted focus:outline-none"
            >
              <option value="all">All assignees</option>
              <option value="__unassigned__">Unassigned</option>
              {assignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          {filterActive && <span className="shrink-0 text-[11px] text-faint">{shownCount} shown</span>}
          {writesEnabled && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:opacity-90"
              >
                <Icon name="Plus" size={13} /> New task
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Run one dispatcher pass? This promotes ready tasks and may spawn workers."))
                    void mutate("/api/hermes/kanban/dispatch");
                }}
                className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
              >
                <Icon name="Workflow" size={13} /> Dispatch
              </button>
            </div>
          )}
        </div>
        {toast && (
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
              toast.ok ? "border-ok/25 bg-ok/10 text-ok" : "border-danger/25 bg-danger/10 text-danger",
            )}
          >
            <Icon name={toast.ok ? "CircleCheck" : "CircleDot"} size={12} className="shrink-0" />
            <span className="max-w-[32rem] whitespace-pre-wrap break-words">{toast.text}</span>
            <button onClick={() => setToast(null)} className="ml-0.5 shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
              <Icon name="X" size={11} />
            </button>
          </span>
        )}
      </div>

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
                    <div key={t.id} className="group flex items-start gap-1">
                      {writesEnabled && (
                        <button
                          onClick={() => toggleSelect(t.id)}
                          className={cn(
                            "mt-3 grid size-4 shrink-0 place-items-center rounded border transition-opacity",
                            selected.has(t.id)
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-line text-transparent opacity-0 group-hover:opacity-100",
                          )}
                          aria-label={selected.has(t.id) ? "Deselect task" : "Select task"}
                        >
                          <Icon name="Check" size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => openTask(t.id)}
                        className={cn(
                          "min-w-0 flex-1 text-left",
                          selectedId === t.id && "rounded-lg ring-1 ring-[var(--accent)]/50",
                          selected.has(t.id) && "rounded-lg ring-1 ring-[var(--accent)]/60",
                        )}
                      >
                        <TaskCard task={t} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {writesEnabled && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-4xl flex-col gap-2 rounded-xl border border-line bg-surface-2 px-3 py-3 shadow-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted">{selected.size} selected</span>
              <span className="text-[11px] text-faint">Shared-note bulk transitions only run on compatible task selections.</span>
              <button onClick={() => setSelected(new Set())} className="ml-auto rounded-md px-2 py-1 text-xs text-faint hover:text-ink">
                Clear
              </button>
            </div>
            <textarea
              value={bulkNote}
              onChange={(event) => setBulkNote(event.target.value)}
              rows={2}
              placeholder="Required handoff/result note for the whole bulk transition…"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-faint focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              {BULK_ACTIONS.map((a) => (
                <button
                  key={a.action}
                  onClick={() => void bulkAction(a.action)}
                  disabled={!bulkNote.trim()}
                  className={cn("rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50", TONE_CLASS[a.tone])}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedId && (
        <TaskDrawer
          detail={detail}
          loading={detailLoading}
          writesEnabled={writesEnabled}
          boardTasks={allTasks}
          onClose={closeDrawer}
          onOpenSession={onOpenSession}
          onMutate={(body) => mutateTask(selectedId, body)}
        />
      )}

      {creating && writesEnabled && (
        <CreateTaskModal
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            const r = await mutate("/api/hermes/kanban/tasks", input);
            if (r.ok) setCreating(false);
            return r;
          }}
        />
      )}
    </div>
  );
}

type TransitionAction = "promote" | "unblock" | "block" | "schedule" | "complete" | "archive";

// Valid transitions per status — mirrors the hermes CLI state machine, so the UI
// only offers actions the CLI will accept.
const STATUS_ACTIONS: Record<string, { action: TransitionAction; label: string; tone: "accent" | "ok" | "warn" | "muted" }[]> = {
  triage: [{ action: "archive", label: "Archive", tone: "muted" }],
  todo: [
    { action: "promote", label: "Promote", tone: "accent" },
    { action: "block", label: "Block", tone: "warn" },
    { action: "archive", label: "Archive", tone: "muted" },
  ],
  scheduled: [
    { action: "unblock", label: "Unblock", tone: "accent" },
    { action: "archive", label: "Archive", tone: "muted" },
  ],
  ready: [
    { action: "block", label: "Block", tone: "warn" },
    { action: "schedule", label: "Schedule", tone: "muted" },
    { action: "archive", label: "Archive", tone: "muted" },
  ],
  running: [
    { action: "complete", label: "Complete", tone: "ok" },
    { action: "block", label: "Block", tone: "warn" },
    { action: "archive", label: "Archive", tone: "muted" },
  ],
  blocked: [
    { action: "unblock", label: "Unblock", tone: "accent" },
    { action: "archive", label: "Archive", tone: "muted" },
  ],
  review: [
    { action: "complete", label: "Complete", tone: "ok" },
    { action: "archive", label: "Archive", tone: "muted" },
  ],
  done: [{ action: "archive", label: "Archive", tone: "muted" }],
  archived: [],
};

const TONE_CLASS: Record<string, string> = {
  accent: "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]",
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/30 bg-warn/10 text-warn",
  muted: "border-line bg-surface-2 text-muted hover:text-ink",
};

// Bulk actions offered in the multi-select bar. The CLI enforces the state
// machine per task and reports which ids it couldn't transition.
const BULK_ACTIONS: { action: TransitionAction; label: string; tone: "accent" | "ok" | "warn" | "muted" }[] = [
  { action: "promote", label: "Promote", tone: "accent" },
  { action: "unblock", label: "Unblock", tone: "accent" },
  { action: "block", label: "Block", tone: "warn" },
  { action: "schedule", label: "Schedule", tone: "muted" },
  { action: "complete", label: "Complete", tone: "ok" },
  { action: "archive", label: "Archive", tone: "muted" },
];

function TaskDrawer({
  detail,
  loading,
  writesEnabled,
  boardTasks,
  onClose,
  onOpenSession,
  onMutate,
}: {
  detail: KanbanTaskDetail | null;
  loading: boolean;
  writesEnabled: boolean;
  boardTasks: KanbanTask[];
  onClose: () => void;
  onOpenSession?: (sessionId: string) => void;
  onMutate: (body: unknown) => Promise<{ ok: boolean; message?: string }>;
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

            {writesEnabled && <TaskActions key={detail.id} detail={detail} onMutate={onMutate} />}

            <DrawerMeta detail={detail} onOpenSession={onOpenSession} />

            {detail.body && (
              <Section title="Description">
                <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface-2/50 p-3">
                  <MarkdownLite source={detail.body} />
                </div>
              </Section>
            )}

            {(writesEnabled || detail.parents.length > 0 || detail.children.length > 0) && (
              <Section title="Links">
                {detail.parents.length > 0 && (
                  <LinkGroup
                    label="Depends on"
                    links={detail.parents}
                    onUnlink={
                      writesEnabled ? (otherId) => void onMutate({ op: "unlink", otherId, direction: "depends-on" }) : undefined
                    }
                  />
                )}
                {detail.children.length > 0 && (
                  <LinkGroup
                    label="Blocks"
                    links={detail.children}
                    onUnlink={
                      writesEnabled ? (otherId) => void onMutate({ op: "unlink", otherId, direction: "blocks" }) : undefined
                    }
                  />
                )}
                {writesEnabled && (
                  <AddLink
                    taskId={detail.id}
                    boardTasks={boardTasks}
                    existing={new Set([detail.id, ...detail.parents.map((p) => p.id), ...detail.children.map((c) => c.id)])}
                    onMutate={onMutate}
                  />
                )}
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

function LinkGroup({
  label,
  links,
  onUnlink,
}: {
  label: string;
  links: KanbanTaskDetail["parents"];
  onUnlink?: (otherId: string) => void;
}) {
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
            <span className="max-w-[180px] truncate">{l.title}</span>
            {onUnlink && (
              <button onClick={() => onUnlink(l.id)} className="shrink-0 text-faint hover:text-danger" aria-label="Unlink">
                <Icon name="X" size={11} />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function TaskActions({
  detail,
  onMutate,
}: {
  detail: KanbanTaskDetail;
  onMutate: (body: unknown) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [acting, setActing] = useState(false);
  const [assignee, setAssignee] = useState(detail.assignee ?? "");
  const [handoffNote, setHandoffNote] = useState("");
  const [comment, setComment] = useState("");

  const act = async (body: unknown, after?: () => void) => {
    setActing(true);
    try {
      const r = await onMutate(body);
      if (r.ok) after?.();
    } finally {
      setActing(false);
    }
  };

  const actions = STATUS_ACTIONS[detail.status] ?? [];

  return (
    <Section title="Actions">
      <div className="mb-3 space-y-1.5">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-faint">Required operator note</label>
        <textarea
          value={handoffNote}
          onChange={(e) => setHandoffNote(e.target.value)}
          rows={2}
          placeholder="Reason, handoff context, or completion result for the next mutation…"
          className="w-full resize-y rounded-md border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink placeholder:text-faint focus:outline-none"
        />
      </div>

      {actions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <button
              key={a.action}
              disabled={acting || !handoffNote.trim()}
              onClick={() => act({ op: "transition", action: a.action, note: handoffNote.trim() }, () => setHandoffNote(""))}
              className={cn("rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50", TONE_CLASS[a.tone])}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="profile"
          className="h-8 flex-1 rounded-md border border-line bg-surface-2 px-2 text-xs text-ink placeholder:text-faint focus:outline-none"
        />
        <button
          disabled={acting || !assignee.trim() || !handoffNote.trim()}
          onClick={() => act({ op: "assign", profile: assignee.trim(), note: handoffNote.trim() }, () => setHandoffNote(""))}
          className="rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
        >
          Assign
        </button>
        {detail.assignee && (
          <button
            disabled={acting || !handoffNote.trim()}
            onClick={() => act({ op: "assign", profile: null, note: handoffNote.trim() }, () => {
              setAssignee("");
              setHandoffNote("");
            })}
            className="rounded-md border border-line px-2.5 py-1 text-xs text-faint hover:text-ink disabled:opacity-50"
          >
            Unassign
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          className="w-full resize-y rounded-md border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink placeholder:text-faint focus:outline-none"
        />
        <div className="flex justify-end">
          <button
            disabled={acting || !comment.trim()}
            onClick={() => act({ op: "comment", text: comment.trim(), author: "agentic-os" }, () => setComment(""))}
            className="rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </div>
    </Section>
  );
}

function CreateTaskModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    body?: string;
    assignee?: string;
    priority?: number;
    triage?: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");
  const [triage, setTriage] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim() || undefined,
        assignee: assignee.trim() || undefined,
        priority: priority.trim() ? Number(priority) : undefined,
        triage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">New task</h3>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <Icon name="X" size={15} />
          </button>
        </div>
        <div className="space-y-2.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-9 w-full rounded-md border border-line bg-surface-2 px-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Description (optional, markdown)"
            className="w-full resize-y rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Assignee (optional)"
              className="h-9 flex-1 rounded-md border border-line bg-surface-2 px-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
            />
            <input
              value={priority}
              onChange={(e) => setPriority(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Priority"
              inputMode="numeric"
              className="h-9 w-24 rounded-md border border-line bg-surface-2 px-2.5 text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={triage} onChange={(e) => setTriage(e.target.checked)} />
            Park in triage (a specifier fleshes out the spec and promotes to todo)
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
            Cancel
          </button>
          <button
            disabled={submitting || !title.trim()}
            onClick={submit}
            className="rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
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

function AddLink({
  taskId,
  boardTasks,
  existing,
  onMutate,
}: {
  taskId: string;
  boardTasks: KanbanTask[];
  existing: Set<string>;
  onMutate: (body: unknown) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [direction, setDirection] = useState<"depends-on" | "blocks">("depends-on");
  const [busy, setBusy] = useState(false);

  void taskId; // self is already excluded via `existing`
  const s = q.trim().toLowerCase();
  const results = boardTasks
    .filter((c) => !existing.has(c.id) && c.status !== "archived")
    .filter((c) => !s || c.id.toLowerCase().includes(s) || c.title.toLowerCase().includes(s))
    .slice(0, 8);

  const add = async (otherId: string) => {
    setBusy(true);
    try {
      const r = await onMutate({ op: "link", otherId, direction });
      if (r.ok) {
        setOpen(false);
        setQ("");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
      >
        <Icon name="Plus" size={12} /> Add link
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-surface-2/50 p-2">
      <div className="mb-2 flex items-center gap-1.5">
        <button
          onClick={() => setDirection("depends-on")}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
            direction === "depends-on" ? TONE_CLASS.accent : TONE_CLASS.muted,
          )}
        >
          Depends on
        </button>
        <button
          onClick={() => setDirection("blocks")}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
            direction === "blocks" ? TONE_CLASS.accent : TONE_CLASS.muted,
          )}
        >
          Blocks
        </button>
        <button onClick={() => setOpen(false)} className="ml-auto text-faint hover:text-ink" aria-label="Cancel">
          <Icon name="X" size={13} />
        </button>
      </div>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search tasks by id or title…"
        className="mb-1.5 h-8 w-full rounded-md border border-line bg-surface px-2 text-xs text-ink placeholder:text-faint focus:outline-none"
      />
      <ul className="max-h-44 space-y-1 overflow-y-auto">
        {results.length === 0 ? (
          <li className="px-1 py-2 text-center text-xs text-faint">No matching tasks</li>
        ) : (
          results.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => add(c.id)}
                disabled={busy}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-2 disabled:opacity-50"
              >
                <StatusDot status={c.status} />
                <span className="font-mono text-faint">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{c.title}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
