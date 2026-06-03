"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import type { HermesCrewActivity, HermesCrewIssue, HermesCrewProfile, HermesCrewRecommendedAction, KanbanTaskDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HermesWorkerDetailPanel } from "./worker-detail-panel";

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "muted" | "info"> = {
  running: "ok",
  online: "ok",
  completed: "ok",
  attention: "warn",
  queued: "info",
  paused: "muted",
  idle: "muted",
  missing: "danger",
  failed: "danger",
  blocked: "danger",
  critical: "danger",
  high: "warn",
  medium: "info",
  low: "muted",
};

function toneFor(status: string): "ok" | "warn" | "danger" | "muted" | "info" {
  return STATUS_TONE[status] ?? "muted";
}

function actionLabel(action: HermesCrewRecommendedAction): string {
  switch (action.kind) {
    case "ack_event":
      return "Acknowledge event";
    case "run_cron":
      return "Run cron now";
    case "pause_cron":
      return "Pause cron";
    case "resume_cron":
      return "Resume cron";
    case "change_task_status":
      return "Update task state";
    case "inspect_config":
      return "Inspect config";
    case "view_logs":
      return "Inspect context";
    case "reassign_task":
      return "Reassign task";
    case "open_session":
      return "Open session";
    default:
      return "Take action";
  }
}

export interface HermesMutationFeedback {
  tone: "success" | "error";
  summary: string;
  detail?: string;
}

export interface HermesIssueContextState {
  loading: boolean;
  taskDetail?: KanbanTaskDetail | null;
  error?: string;
}

function ConfigRemediationCard({ issue }: { issue: HermesCrewIssue }) {
  const primary = issue.affectedObjects[0];
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3 text-xs">
      <div className="font-semibold text-ink">Read-only remediation guidance</div>
      <p className="mt-1 text-faint">{issue.plainEnglish}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-surface px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-faint">Expected state</div>
          <div className="mt-1 text-muted">{issue.recommendedAction?.summary ?? "Verify the expected Hermes lane wiring."}</div>
        </div>
        <div className="rounded-md border border-line bg-surface px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-faint">Observed state</div>
          <div className="mt-1 text-muted">{primary?.detail ?? primary?.summary ?? issue.summary}</div>
        </div>
      </div>
      {primary && (
        <div className="mt-3 rounded-md border border-line bg-surface px-3 py-2 text-faint">
          <div><span className="text-muted">Target:</span> {primary.kind} · {primary.label}</div>
          {primary.profile && <div className="mt-1"><span className="text-muted">Worker lane:</span> {primary.profile}</div>}
        </div>
      )}
    </div>
  );
}

function TaskContextCard({
  context,
  onOpenSession,
}: {
  context: HermesIssueContextState;
  onOpenSession?: (sessionId: string) => void;
}) {
  const taskDetail = context.taskDetail;

  if (context.loading) {
    return <div className="rounded-lg border border-line bg-surface-2 px-3 py-3 text-xs text-faint">Loading task context…</div>;
  }

  if (context.error) {
    return <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-3 text-xs text-danger">{context.error}</div>;
  }

  if (!taskDetail) {
    return <div className="rounded-lg border border-line bg-surface-2 px-3 py-3 text-xs text-faint">Use Inspect context to load task runs, failure details, workspace information, and any linked Hermes session.</div>;
  }

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-ink">{taskDetail.title}</div>
          <div className="mt-1 text-faint">Status {taskDetail.status}{taskDetail.currentStepKey ? ` · Step ${taskDetail.currentStepKey}` : ""}</div>
        </div>
        {taskDetail.sessionId && onOpenSession && (
          <button
            type="button"
            onClick={() => onOpenSession(taskDetail.sessionId!)}
            className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-[var(--accent)] hover:border-[var(--accent)]/35"
          >
            Open linked session
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {taskDetail.workspacePath && (
          <div className="rounded-md border border-line bg-surface px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-faint">Workspace</div>
            <div className="mt-1 break-all text-muted">{taskDetail.workspacePath}</div>
          </div>
        )}
        {taskDetail.lastFailureError && (
          <div className="rounded-md border border-line bg-surface px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-faint">Last failure</div>
            <div className="mt-1 whitespace-pre-wrap text-muted">{taskDetail.lastFailureError}</div>
          </div>
        )}
        {taskDetail.result && (
          <div className="rounded-md border border-line bg-surface px-3 py-2 sm:col-span-2">
            <div className="text-[11px] uppercase tracking-wide text-faint">Latest result</div>
            <div className="mt-1 whitespace-pre-wrap text-muted">{taskDetail.result}</div>
          </div>
        )}
      </div>
      {(taskDetail.runs.length > 0 || taskDetail.events.length > 0) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {taskDetail.runs.length > 0 && (
            <div className="rounded-md border border-line bg-surface px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-faint">Recent runs</div>
              <ul className="mt-2 space-y-1.5">
                {taskDetail.runs.slice(0, 3).map((run) => (
                  <li key={run.id} className="text-faint">
                    <span className="text-muted">{run.status ?? run.outcome ?? "run"}</span>
                    {run.summary ? ` · ${run.summary}` : ""}
                    {run.duration ? ` · ${run.duration}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {taskDetail.events.length > 0 && (
            <div className="rounded-md border border-line bg-surface px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-faint">Recent events</div>
              <ul className="mt-2 space-y-1.5">
                {taskDetail.events.slice(0, 4).map((event) => (
                  <li key={event.id} className="text-faint">
                    <span className="text-muted">{event.kind}</span>
                    {event.summary ? ` · ${event.summary}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HermesWorkerDrawer({
  profile,
  activity,
  focusedIssueId,
  onFocusIssue,
  onClose,
  onRunAction,
  actionCapabilities,
  mutationPending = false,
  mutationFeedback,
  issueContext = { loading: false },
  onOpenSession,
}: {
  profile: HermesCrewProfile;
  activity: HermesCrewActivity[];
  focusedIssueId?: string;
  onFocusIssue: (issueId: string) => void;
  onClose: () => void;
  onRunAction: (issue: HermesCrewIssue, note?: string) => Promise<void>;
  actionCapabilities: {
    crewActionsEnabled: boolean;
    cronActionsEnabled: boolean;
    kanbanWritesEnabled: boolean;
  };
  mutationPending?: boolean;
  mutationFeedback?: HermesMutationFeedback | null;
  issueContext?: HermesIssueContextState;
  onOpenSession?: (sessionId: string) => void;
}) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const [noteState, setNoteState] = useState<{ issueId?: string; note: string }>({ issueId: focusedIssueId, note: "" });
  const focusedIssue = useMemo(
    () => profile.issues.find((issue) => issue.id === focusedIssueId) ?? profile.issues[0],
    [focusedIssueId, profile.issues],
  );
  const note = noteState.issueId === focusedIssue?.id ? noteState.note : "";

  useEffect(() => {
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lastFocusedElementRef.current?.focus();
    };
  }, [onClose]);

  const action = focusedIssue?.recommendedAction;
  const actionEnabled = !action
    ? false
    : action.kind === "ack_event"
      ? actionCapabilities.crewActionsEnabled
      : ["run_cron", "pause_cron", "resume_cron"].includes(action.kind)
        ? actionCapabilities.cronActionsEnabled
        : action.kind === "change_task_status"
          ? actionCapabilities.kanbanWritesEnabled
          : ["view_logs", "inspect_config", "open_session"].includes(action.kind);
  const actionSupported = Boolean(
    action && ["ack_event", "run_cron", "pause_cron", "resume_cron", "change_task_status", "view_logs", "inspect_config", "open_session"].includes(action.kind) && actionEnabled,
  );
  const actionDisabledReason = !action
    ? "No direct action suggested yet."
    : !actionEnabled
      ? "This action is currently disabled by the active Hermes capability gates. Re-enable the matching write path before retrying."
      : actionSupported
        ? undefined
        : "This issue currently requires manual follow-up outside the drawer. Use the summary below as your operator checklist.";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${profile.name} worker drawer`}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <aside ref={drawerRef} className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-line bg-surface shadow-2xl">
        <div className="sticky top-0 z-[2] border-b border-line bg-surface/95 backdrop-blur">
          <div className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-ink">{profile.name}</h3>
                <Badge tone={toneFor(profile.status)}>{profile.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-faint">{profile.prioritySummary}</p>
              {focusedIssue && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5">Focused issue</span>
                  <span className="font-medium text-ink">{focusedIssue.title}</span>
                  <Badge tone={toneFor(focusedIssue.severity)}>{focusedIssue.severity}</Badge>
                </div>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Close drawer"
            >
              <Icon name="X" size={16} />
            </button>
          </div>

          <div className="border-t border-line px-5 py-3">
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-faint">Recommended action</div>
                  <div className="mt-1 text-sm font-medium text-ink">{action ? actionLabel(action) : "No direct drawer action available"}</div>
                  <p className="mt-1 text-xs text-faint">
                    {focusedIssue?.recommendedAction?.summary ?? actionDisabledReason ?? "Review the worker details below to decide on next steps."}
                  </p>
                </div>
                {focusedIssue && actionSupported ? (
                  <button
                    type="button"
                    onClick={() => void onRunAction(focusedIssue, note.trim() || undefined)}
                    disabled={mutationPending || Boolean(action?.noteRequired && note.trim().length === 0)}
                    className={cn(
                      "shrink-0 rounded-md px-3 py-2 text-xs font-semibold text-white transition-opacity",
                      mutationPending || Boolean(action?.noteRequired && note.trim().length === 0)
                        ? "bg-[var(--accent)]/60"
                        : "bg-[var(--accent)] hover:opacity-90",
                    )}
                  >
                    {mutationPending ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="Loader" size={13} className="animate-spin" /> Working…
                      </span>
                    ) : (
                      actionLabel(action!)
                    )}
                  </button>
                ) : null}
              </div>

              {action && (
                <>
                  {(action.noteRequired || action.kind === "ack_event") && (
                    <div className="mt-3">
                      <label className="mb-1 block text-[11px] font-medium text-faint" htmlFor="hermes-operator-note">
                        Operator note {action.noteRequired ? "(required)" : "(optional)"}
                      </label>
                      <textarea
                        id="hermes-operator-note"
                        value={note}
                        onChange={(event) =>
                          setNoteState({
                            issueId: focusedIssue?.id,
                            note: event.target.value,
                          })
                        }
                        rows={3}
                        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none ring-0 placeholder:text-faint focus:border-[var(--accent)]"
                        placeholder={action.noteRequired ? "Add the handoff or unblock note that explains the operator decision." : "Optional acknowledgement note for future operators."}
                      />
                    </div>
                  )}

                  {action.noteRequired && note.trim().length === 0 && actionSupported && (
                    <p className="mt-2 text-xs text-warn">This action needs an operator note before it can be completed safely.</p>
                  )}
                </>
              )}
            </div>

            {mutationFeedback && (
              <div
                className={cn(
                  "mt-3 rounded-lg border px-3 py-2 text-xs",
                  mutationFeedback.tone === "success"
                    ? "border-ok/25 bg-ok/10 text-ok"
                    : "border-danger/25 bg-danger/10 text-danger",
                )}
              >
                <div className="font-semibold">{mutationFeedback.summary}</div>
                {mutationFeedback.detail && (
                  <details className="mt-1 text-[11px]">
                    <summary className="cursor-pointer select-none">Details</summary>
                    <div className="mt-2 whitespace-pre-wrap">{mutationFeedback.detail}</div>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {profile.issues.length === 0 && (
            <div className="mb-3 rounded-lg border border-ok/25 bg-ok/10 px-3 py-2 text-xs text-ok">
              This worker is currently healthy. The drawer still shows activity and operator history so you can verify lane readiness.
            </div>
          )}
          <HermesWorkerDetailPanel
            profile={profile}
            activity={activity}
            focusedIssueId={focusedIssue?.id}
            onFocusIssue={onFocusIssue}
            disableIssueFocus={mutationPending}
          />

          {focusedIssue?.recommendedAction?.kind === "inspect_config" && (
            <section className="mt-3">
              <ConfigRemediationCard issue={focusedIssue} />
            </section>
          )}

          {focusedIssue?.type === "task" && (
            <section className="mt-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">Task context</span>
              </div>
              <TaskContextCard context={issueContext} onOpenSession={onOpenSession} />
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
