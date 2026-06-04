"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { HermesCrewDashboard, HermesCrewIssue, HermesCrewJob, KanbanMutationResult, KanbanTaskDetail, SessionDetail } from "@/lib/types";
import { HermesAllIssuesPanel } from "./all-issues-panel";
import { HermesWorkerDrawer, type HermesMutationFeedback } from "./worker-drawer";
import { HermesWorkerCard } from "./worker-card";

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
};

function toneFor(status: string): "ok" | "warn" | "danger" | "muted" | "info" {
  return STATUS_TONE[status] ?? "muted";
}

function JobRow({ job }: { job: HermesCrewJob }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium text-muted">{job.name}</span>
        <span className="block truncate font-mono text-[11px] text-faint">
          {job.schedule ?? "manual"} {job.deliver ? `· ${job.deliver}` : ""}
        </span>
        {job.lastError && <span className="mt-1 block line-clamp-2 text-xs text-danger">{job.lastError}</span>}
      </span>
      <Badge tone={toneFor(job.status)}>{job.status}</Badge>
    </li>
  );
}

function CapabilityPill({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        enabled ? "border-ok/25 bg-ok/10 text-ok" : "border-line bg-surface-2 text-faint",
      )}
    >
      <span className={cn("size-1.5 rounded-full", enabled ? "bg-ok" : "bg-faint")} />
      {label}
    </span>
  );
}

function taskTargetId(issue: HermesCrewIssue): string | undefined {
  return issue.recommendedAction?.targetId ?? issue.affectedObjects.find((obj) => obj.kind === "task")?.id;
}

function actionRequest(issue: HermesCrewIssue, note?: string): { url: string; body?: Record<string, string> } | null {
  const action = issue.recommendedAction;
  if (!action?.targetId) return null;

  switch (action.kind) {
    case "ack_event":
      return { url: `/api/hermes/crew/events/${action.targetId}/ack`, body: note?.trim() ? { note: note.trim() } : undefined };
    case "run_cron":
      return { url: `/api/hermes/cron/${action.targetId}/run` };
    case "pause_cron":
      return { url: `/api/hermes/cron/${action.targetId}/pause` };
    case "resume_cron":
      return { url: `/api/hermes/cron/${action.targetId}/resume` };
    case "change_task_status":
      return {
        url: `/api/hermes/kanban/tasks/${action.targetId}`,
        body: {
          op: "transition",
          action: "unblock",
          issueId: issue.id,
          ...(note?.trim() ? { note: note.trim() } : {}),
        },
      };
    default:
      return null;
  }
}

type HermesIssueContext = {
  issueId?: string;
  loading: boolean;
  taskDetail?: KanbanTaskDetail | null;
  error?: string;
};

export function HermesMissionControlClient({
  dashboard,
  framed = false,
  onOpenSession,
}: {
  dashboard: HermesCrewDashboard;
  framed?: boolean;
  onOpenSession?: (sessionId: string) => void;
}) {
  const allIssuesPanelId = "hermes-all-issues-panel";
  const [liveDashboard, setLiveDashboard] = useState(dashboard);
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(
    dashboard.crew.find((profile) => profile.id === dashboard.activeProfile)?.id ?? dashboard.crew[0]?.id,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusedIssueId, setFocusedIssueId] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationFeedback, setMutationFeedback] = useState<HermesMutationFeedback | null>(null);
  const [allIssuesOpen, setAllIssuesOpen] = useState(false);
  const [selectedAllIssueIds, setSelectedAllIssueIds] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<HermesMutationFeedback | null>(null);
  const [issueContext, setIssueContext] = useState<HermesIssueContext>({ loading: false });
  const latestSelectionRef = useRef<{ profileId?: string; issueId?: string }>({
    profileId: selectedProfileId,
    issueId: focusedIssueId,
  });
  const refreshRequestIdRef = useRef(0);

  const failedJobs = liveDashboard.jobs.filter((job) => job.status === "failed");
  const visibleJobs = [...failedJobs, ...liveDashboard.jobs.filter((job) => job.status !== "failed")].slice(0, 6);
  const rootClass = framed ? "panel" : "";
  const profileOptions = liveDashboard.crew.map((profile) => ({ id: profile.id, name: profile.name }));
  const selectedProfile = liveDashboard.crew.find((profile) => profile.id === selectedProfileId) ?? liveDashboard.crew[0];
  const focusedIssue = selectedProfile?.issues.find((issue) => issue.id === focusedIssueId) ?? selectedProfile?.issues[0];

  useEffect(() => {
    latestSelectionRef.current = {
      profileId: selectedProfile?.id,
      issueId: focusedIssue?.id,
    };
  }, [focusedIssue?.id, selectedProfile?.id]);

  async function refreshDashboard(nextSelection?: { profileId?: string; issueId?: string }) {
    const requestId = ++refreshRequestIdRef.current;
    setRefreshing(true);
    try {
      const res = await fetch("/api/hermes/crew", { cache: "no-store" });
      if (requestId !== refreshRequestIdRef.current) return;
      if (!res.ok) {
        const detail = await res.text();
        setMutationFeedback({
          tone: "error",
          summary: "Mission Control refresh failed.",
          detail,
        });
        return;
      }
      const next = (await res.json()) as HermesCrewDashboard;
      if (requestId !== refreshRequestIdRef.current) return;
      setLiveDashboard(next);
      const desiredSelection = nextSelection ?? latestSelectionRef.current;
      const requestedProfile = next.crew.find((profile) => profile.id === desiredSelection.profileId);
      const fallbackProfile = requestedProfile ?? next.crew.find((profile) => profile.id === selectedProfileId) ?? next.crew[0];
      setSelectedProfileId(fallbackProfile?.id);
      const preservedIssue = fallbackProfile?.issues.find((issue) => issue.id === desiredSelection.issueId) ?? fallbackProfile?.issues[0];
      setFocusedIssueId(preservedIssue?.id);
    } catch (error) {
      if (requestId !== refreshRequestIdRef.current) return;
      setMutationFeedback({
        tone: "error",
        summary: "Mission Control refresh failed.",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (requestId === refreshRequestIdRef.current) {
        setRefreshing(false);
      }
    }
  }

  async function runRecommendedAction(issue: HermesCrewIssue, note?: string) {
    const request = actionRequest(issue, note);
    const action = issue.recommendedAction;

    if (action?.kind === "view_logs") {
      const taskDetail = await inspectTaskContext(issue);
      setMutationFeedback({
        tone: taskDetail ? "success" : "error",
        summary: taskDetail ? `Loaded context for ${taskDetail.title}.` : "Failed to load task context.",
        detail: taskDetail
          ? [
              taskDetail.lastFailureError ? `Last failure: ${taskDetail.lastFailureError}` : undefined,
              taskDetail.result ? `Latest result: ${taskDetail.result}` : undefined,
              taskDetail.workspacePath ? `Workspace: ${taskDetail.workspacePath}` : undefined,
            ].filter(Boolean).join("\n") || undefined
          : undefined,
      });
      return;
    }

    if (action?.kind === "inspect_config") {
      setMutationFeedback({
        tone: "success",
        summary: "Read-only remediation guidance loaded below.",
        detail: action.summary,
      });
      return;
    }

    if (action?.kind === "open_session") {
      const sessionId = action.targetId ?? issue.affectedObjects.find((obj) => obj.kind === "session")?.id;
      if (sessionId && onOpenSession) {
        await openLinkedSession(sessionId);
        setMutationFeedback({
          tone: "success",
          summary: "Opened the linked Hermes session in Chat.",
        });
      } else {
        setMutationFeedback({
          tone: "error",
          summary: "No linked Hermes session is available for this issue.",
        });
      }
      return;
    }

    if (!request || !action) {
      setMutationFeedback({
        tone: "error",
        summary: "This issue does not have a runnable drawer action yet.",
        detail: "Use the issue summary to complete the follow-up manually.",
      });
      return;
    }
    if (action.noteRequired && !note?.trim()) {
      setMutationFeedback({
        tone: "error",
        summary: "Operator note required before this action can run.",
        detail: "Add the handoff or unblock note so future operators can understand the state change.",
      });
      return;
    }

    setMutationPending(true);
    setMutationFeedback(null);
    const selectionAtDispatch = latestSelectionRef.current;
    try {
      const res = await fetch(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body ?? {}),
      });
      const payload = (await res.json().catch(() => null)) as KanbanMutationResult | null;
      if (!res.ok || !payload?.ok) {
        setMutationFeedback({
          tone: "error",
          summary: payload?.message || `Failed to ${action.label.toLowerCase()}.`,
          detail: payload?.detail,
        });
        await refreshDashboard(selectionAtDispatch);
        return;
      }

      setMutationFeedback({
        tone: "success",
        summary: payload.message || `${action.label} completed successfully.`,
      });
      await refreshDashboard(selectionAtDispatch);
    } catch (error) {
      setMutationFeedback({
        tone: "error",
        summary: `Failed to ${action.label.toLowerCase()}.`,
        detail: error instanceof Error ? error.message : String(error),
      });
      await refreshDashboard(selectionAtDispatch);
    } finally {
      setMutationPending(false);
    }
  }

  const selectedIssueSummary = useMemo(() => {
    if (!selectedProfile) return null;
    return focusedIssue ?? null;
  }, [focusedIssue, selectedProfile]);

  const activeSelectedAllIssueIds = useMemo(() => {
    const validIssueIds = new Set(liveDashboard.issues.map((issue) => issue.id));
    return selectedAllIssueIds.filter((issueId) => validIssueIds.has(issueId));
  }, [liveDashboard.issues, selectedAllIssueIds]);

  async function inspectTaskContext(issue: HermesCrewIssue): Promise<KanbanTaskDetail | null> {
    const taskId = taskTargetId(issue);
    if (!taskId) {
      setIssueContext({ issueId: issue.id, loading: false, error: "No task context is available for this issue." });
      return null;
    }

    setIssueContext({ issueId: issue.id, loading: true });
    try {
      const res = await fetch(`/api/hermes/kanban/tasks/${taskId}`, { cache: "no-store" });
      if (!res.ok) {
        const detail = await res.text();
        setIssueContext({ issueId: issue.id, loading: false, error: detail || "Failed to load task context." });
        return null;
      }
      const taskDetail = (await res.json()) as KanbanTaskDetail;
      setIssueContext({ issueId: issue.id, loading: false, taskDetail });
      return taskDetail;
    } catch (error) {
      setIssueContext({
        issueId: issue.id,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async function openLinkedSession(sessionId: string) {
    if (!onOpenSession) return;

    try {
      const res = await fetch(`/api/hermes/sessions/${sessionId}`, { cache: "no-store" });
      if (res.ok) {
        const detail = (await res.json()) as SessionDetail;
        onOpenSession(detail.resumeId ?? detail.id);
        return;
      }
    } catch {
      // fall through to raw session id
    }

    onOpenSession(sessionId);
  }

  function openWorkerIssue(profileId: string, issueId: string) {
    if (mutationPending) return;
    setSelectedProfileId(profileId);
    setFocusedIssueId(issueId);
    setDrawerOpen(true);
    setMutationFeedback(null);
    setIssueContext({ loading: false });
  }

  async function runBulkAction(action: "promote" | "unblock" | "block" | "schedule" | "complete" | "archive", note: string, issueIds: string[]) {
    const selectedIssueEntries = issueIds.map((issueId) => ({
      issueId,
      issue: liveDashboard.issues.find((issue) => issue.id === issueId),
    }));
    const taskIds = selectedIssueEntries
      .map(({ issue }) => issue?.recommendedAction?.targetId ?? issue?.affectedObjects.find((obj) => obj.kind === "task")?.id)
      .filter((taskId): taskId is string => Boolean(taskId));

    if (taskIds.length !== issueIds.length) {
      setBulkFeedback({
        tone: "error",
        summary: "Bulk transition selection is incomplete.",
        detail: "Only task issues with a concrete task target can be transitioned in bulk.",
      });
      return;
    }

    setBulkPending(true);
    setBulkFeedback(null);
    const selectionAtDispatch = latestSelectionRef.current;
    try {
      const res = await fetch("/api/hermes/kanban/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: taskIds, note, issueIds }),
      });
      const payload = (await res.json().catch(() => null)) as KanbanMutationResult | null;
      if (!res.ok || !payload?.ok) {
        setBulkFeedback({
          tone: "error",
          summary: payload?.message || `Failed to ${action} selected tasks.`,
          detail: payload?.detail,
        });
        await refreshDashboard(selectionAtDispatch);
        return;
      }

      setSelectedAllIssueIds([]);
      setBulkFeedback({
        tone: "success",
        summary: payload.message,
        detail: payload.detail,
      });
      await refreshDashboard(selectionAtDispatch);
    } catch (error) {
      setBulkFeedback({
        tone: "error",
        summary: `Failed to ${action} selected tasks.`,
        detail: error instanceof Error ? error.message : String(error),
      });
      await refreshDashboard(selectionAtDispatch);
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <section className={cn(rootClass, framed ? "p-5" : "space-y-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="Workflow" size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-ink">Hermes Mission Control</h2>
          </div>
          <p className="mt-1 text-xs text-faint">
            {liveDashboard.activeProfile ?? "default"} · Discord {liveDashboard.gateway.discord} · {liveDashboard.stats.availableProfiles}/{liveDashboard.stats.profiles} profiles ready
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void refreshDashboard({ profileId: selectedProfile?.id, issueId: focusedIssue?.id })}
            disabled={refreshing || mutationPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-[var(--accent)]/35 hover:text-ink disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Icon name="RefreshCw" size={12} className={refreshing ? "animate-spin" : undefined} /> Refresh
          </button>
          <CapabilityPill enabled={liveDashboard.actions.kanbanWritesEnabled} label="Kanban actions" />
          <CapabilityPill enabled={liveDashboard.actions.cronActionsEnabled} label="Cron actions" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <div className="tile px-3 py-2">
          <div className="text-lg font-semibold text-ink">{liveDashboard.stats.openTasks}</div>
          <div className="text-[11px] text-faint">open tasks</div>
        </div>
        <div className="tile px-3 py-2">
          <div className="text-lg font-semibold text-ink">{liveDashboard.stats.runningTasks}</div>
          <div className="text-[11px] text-faint">running</div>
        </div>
        <div className="tile px-3 py-2">
          <div className={cn("text-lg font-semibold", liveDashboard.stats.activeIssues > 0 ? "text-warn" : "text-ink")}>
            {liveDashboard.stats.activeIssues}
          </div>
          <div className="text-[11px] text-faint">active issues</div>
        </div>
        <div className="tile px-3 py-2">
          <div className={cn("text-lg font-semibold", liveDashboard.stats.failedJobs > 0 ? "text-danger" : "text-ink")}>
            {liveDashboard.stats.failedJobs}
          </div>
          <div className="text-[11px] text-faint">failed jobs</div>
        </div>
        <div className="tile px-3 py-2">
          <div className={cn("text-lg font-semibold", liveDashboard.stats.missingPrivateChannels > 0 ? "text-warn" : "text-ink")}>
            {liveDashboard.stats.missingPrivateChannels}
          </div>
          <div className="text-[11px] text-faint">channel gaps</div>
        </div>
      </div>

      <div className="mt-4 tile p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Cross-worker triage</div>
            <p className="mt-1 text-xs text-faint">
              Keep the worker grid as the home surface, then expand this queue when you need to sort every active issue globally.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAllIssuesOpen((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-[var(--accent)]/35 hover:text-ink"
            aria-expanded={allIssuesOpen}
            aria-controls={allIssuesPanelId}
          >
            <Icon name={allIssuesOpen ? "ChevronUp" : "ChevronDown"} size={12} />
            {allIssuesOpen ? "Hide All issues" : `Open All issues (${liveDashboard.issues.length})`}
          </button>
        </div>
      </div>

      {allIssuesOpen && (
        <HermesAllIssuesPanel
          panelId={allIssuesPanelId}
          issues={liveDashboard.issues}
          profileOptions={profileOptions}
          selectedIssueIds={activeSelectedAllIssueIds}
          onToggleIssue={(issueId) =>
            setSelectedAllIssueIds((current) =>
              current.includes(issueId) ? current.filter((entry) => entry !== issueId) : [...current, issueId],
            )
          }
          onOpenIssue={openWorkerIssue}
          onRunBulkAction={runBulkAction}
          bulkPending={bulkPending}
          bulkFeedback={bulkFeedback}
        />
      )}

      {liveDashboard.attention.length > 0 && (
        <div className="mt-4 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warn">
            <Icon name="Bell" size={13} /> Attention
          </div>
          <ul className="space-y-1 text-xs text-muted">
            {liveDashboard.attention.slice(0, 4).map((item) => (
              <li key={item} className="line-clamp-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,2.4fr)_minmax(320px,1fr)]">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {liveDashboard.crew.map((profile) => (
            <HermesWorkerCard
              key={profile.id}
              profile={profile}
              selected={profile.id === selectedProfile?.id}
              onSelect={() => {
                if (mutationPending) return;
                const preservingCurrentIssue = profile.id === selectedProfile?.id ? focusedIssue?.id : undefined;
                setSelectedProfileId(profile.id);
                setFocusedIssueId(preservingCurrentIssue ?? profile.issues[0]?.id);
                setDrawerOpen(true);
                setMutationFeedback(null);
                setIssueContext({ loading: false });
              }}
            />
          ))}
        </div>

        <div className="min-w-0 space-y-3">
          {selectedProfile && (
            <div className="tile min-w-0 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">Selected worker</span>
                <button
                  type="button"
                  onClick={() => {
                    if (mutationPending) return;
                    setDrawerOpen(true);
                    setMutationFeedback(null);
                  }}
                  disabled={mutationPending}
                  className="text-xs font-medium text-[var(--accent)] hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-70"
                >
                  Open drawer
                </button>
              </div>
              <div className="min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2 text-xs">
                <div className="font-medium text-muted">{selectedProfile.name}</div>
                <div className="mt-1 break-words text-faint">{selectedProfile.prioritySummary}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={toneFor(selectedProfile.status)}>{selectedProfile.status}</Badge>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-faint">{selectedProfile.issueCount} issues</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-faint">{selectedProfile.runningTasks} running</span>
                </div>
                {selectedIssueSummary && <div className="mt-2 break-words text-faint">Focused issue: {selectedIssueSummary.title}</div>}
              </div>
            </div>
          )}

          <div className="tile min-w-0 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">Automation</span>
              <Link href="/agents/hermes" className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
                Hermes <Icon name="ArrowRight" size={12} />
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {visibleJobs.length === 0 ? (
                <li className="py-4 text-center text-xs text-faint">No cron jobs detected</li>
              ) : (
                visibleJobs.map((job) => <JobRow key={job.id} job={job} />)
              )}
            </ul>
          </div>
        </div>
      </div>
      {drawerOpen && selectedProfile && (
        <HermesWorkerDrawer
          profile={selectedProfile}
          activity={liveDashboard.activity}
          focusedIssueId={focusedIssue?.id}
          onFocusIssue={(issueId) => {
            setFocusedIssueId(issueId);
            setIssueContext((current) => (current.issueId === issueId ? current : { loading: false }));
          }}
          onClose={() => setDrawerOpen(false)}
          onRunAction={runRecommendedAction}
          actionCapabilities={liveDashboard.actions}
          mutationPending={mutationPending}
          mutationFeedback={mutationFeedback}
          issueContext={issueContext.issueId === focusedIssue?.id ? issueContext : { loading: false }}
          onOpenSession={(sessionId) => {
            void openLinkedSession(sessionId);
          }}
        />
      )}
    </section>
  );
}
