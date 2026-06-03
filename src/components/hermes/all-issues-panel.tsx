"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HermesCrewIssue, HermesCrewIssueSeverity, HermesCrewIssueType } from "@/lib/types";
import { HermesIssueDetail } from "./issue-detail";
import { HermesIssueFilters } from "./issue-filters";

const SEVERITY_ORDER: HermesCrewIssueSeverity[] = ["critical", "high", "medium", "low"];
const TONE: Record<string, "ok" | "warn" | "danger" | "muted" | "info"> = {
  critical: "danger",
  high: "warn",
  medium: "info",
  low: "muted",
};
const BULK_ACTION_OPTIONS = [
  ["promote", "Promote"],
  ["unblock", "Unblock"],
  ["block", "Block"],
  ["schedule", "Schedule"],
  ["complete", "Complete"],
  ["archive", "Archive"],
] as const;
const BULK_COMPATIBILITY: Record<string, string[]> = {
  promote: ["todo"],
  unblock: ["scheduled", "blocked"],
  block: ["todo", "ready", "running"],
  schedule: ["ready"],
  complete: ["running", "review"],
  archive: ["triage", "todo", "scheduled", "ready", "running", "blocked", "review", "done"],
};

type BulkAction = (typeof BULK_ACTION_OPTIONS)[number][0];

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function matchesSearch(issue: HermesCrewIssue, query: string): boolean {
  if (!query) return true;
  const haystack = [
    issue.title,
    issue.summary,
    issue.plainEnglish,
    issue.profile,
    issue.type,
    ...issue.affectedObjects.map((obj) => `${obj.kind} ${obj.label} ${obj.summary ?? ""} ${obj.detail ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function taskIssueTargetId(issue: HermesCrewIssue): string | undefined {
  return issue.recommendedAction?.targetId ?? issue.affectedObjects.find((obj) => obj.kind === "task")?.id;
}

export function HermesAllIssuesPanel({
  panelId,
  issues,
  profileOptions,
  selectedIssueIds,
  onToggleIssue,
  onOpenIssue,
  onRunBulkAction,
  bulkPending = false,
  bulkFeedback,
}: {
  panelId: string;
  issues: HermesCrewIssue[];
  profileOptions: { id: string; name: string }[];
  selectedIssueIds: string[];
  onToggleIssue: (issueId: string) => void;
  onOpenIssue: (profileId: string, issueId: string) => void;
  onRunBulkAction: (action: BulkAction, note: string, issueIds: string[]) => Promise<void>;
  bulkPending?: boolean;
  bulkFeedback?: { tone: "success" | "error"; summary: string; detail?: string } | null;
}) {
  const [search, setSearch] = useState("");
  const [selectedSeverities, setSelectedSeverities] = useState<HermesCrewIssueSeverity[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<HermesCrewIssueType[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("unblock");
  const [bulkNote, setBulkNote] = useState("");
  const [confirmBulk, setConfirmBulk] = useState(false);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (selectedSeverities.length > 0 && !selectedSeverities.includes(issue.severity)) return false;
      if (selectedProfileIds.length > 0 && !selectedProfileIds.includes(issue.profile)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(issue.type)) return false;
      return matchesSearch(issue, search);
    });
  }, [issues, search, selectedProfileIds, selectedSeverities, selectedTypes]);

  const groupedIssues = useMemo(() => {
    return SEVERITY_ORDER.map((severity) => ({
      severity,
      issues: filteredIssues
        .filter((issue) => issue.severity === severity)
        .sort((left, right) => {
          if (right.productionImpact !== left.productionImpact) return right.productionImpact - left.productionImpact;
          return left.rank - right.rank;
        }),
    })).filter((group) => group.issues.length > 0);
  }, [filteredIssues]);

  const selectedIssues = useMemo(() => issues.filter((issue) => selectedIssueIds.includes(issue.id)), [issues, selectedIssueIds]);
  const selectedTaskIssues = useMemo(
    () => selectedIssues.filter((issue) => issue.type === "task" && issue.status && taskIssueTargetId(issue)),
    [selectedIssues],
  );
  const selectedTaskTargetIds = useMemo(() => selectedTaskIssues.map((issue) => taskIssueTargetId(issue)).filter(Boolean) as string[], [selectedTaskIssues]);
  const compatibleStatuses = new Set(BULK_COMPATIBILITY[bulkAction]);
  const incompatibleSelections = selectedTaskIssues.filter((issue) => !issue.status || !compatibleStatuses.has(issue.status));
  const nonTaskSelectionCount = selectedIssues.length - selectedTaskIssues.length;
  const canRunBulk =
    selectedIssues.length > 0 &&
    nonTaskSelectionCount === 0 &&
    selectedTaskTargetIds.length === selectedIssues.length &&
    incompatibleSelections.length === 0 &&
    bulkNote.trim().length > 0 &&
    confirmBulk;

  const bulkGuardrail =
    selectedIssues.length === 0
      ? "Select one or more task issues to prepare a shared transition."
      : nonTaskSelectionCount > 0
        ? "Bulk transitions only support task issues right now. Remove cron/config/event selections first."
        : incompatibleSelections.length > 0
          ? `The current action only supports ${Array.from(compatibleStatuses).join(", ")} tasks. Incompatible: ${incompatibleSelections.map((issue) => `${issue.title} (${issue.status})`).join(", ")}`
          : bulkNote.trim().length === 0
            ? "A shared operator note is required before the bulk action can run."
            : !confirmBulk
              ? "Confirm the exact action and affected issue count before applying the transition."
              : undefined;

  return (
    <section id={panelId} className="tile p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">All issues</div>
          <p className="mt-1 text-xs text-faint">Cross-worker triage stays secondary to the worker grid, but lets operators sort, filter, and jump directly into the right drawer context.</p>
        </div>
        <div className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] text-faint">
          {filteredIssues.length} visible / {issues.length} total
        </div>
      </div>

      <div className="mt-3">
        <HermesIssueFilters
          search={search}
          onSearchChange={setSearch}
          selectedSeverities={selectedSeverities}
          onToggleSeverity={(severity) => setSelectedSeverities((current) => toggleValue(current, severity))}
          selectedProfileIds={selectedProfileIds}
          profileOptions={profileOptions}
          onToggleProfile={(profileId) => setSelectedProfileIds((current) => toggleValue(current, profileId))}
          selectedTypes={selectedTypes}
          onToggleType={(type) => setSelectedTypes((current) => toggleValue(current, type))}
          onReset={() => {
            setSearch("");
            setSelectedSeverities([]);
            setSelectedProfileIds([]);
            setSelectedTypes([]);
          }}
        />
      </div>

      <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-faint">Bulk task transition</div>
            <p className="mt-1 text-xs text-faint">Apply one shared-note status transition to a compatible task selection. The exact task ids stay server-validated before any write happens.</p>
          </div>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-faint">{selectedIssues.length} selected</span>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-start">
          <label className="block text-xs text-faint">
            <span className="mb-1 block font-medium">Action</span>
            <select
              value={bulkAction}
              onChange={(event) => {
                setBulkAction(event.target.value as BulkAction);
                setConfirmBulk(false);
              }}
              className="h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none"
            >
              {BULK_ACTION_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-faint">
            <span className="mb-1 block font-medium">Shared operator note</span>
            <textarea
              value={bulkNote}
              onChange={(event) => setBulkNote(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-[var(--accent)]"
              placeholder="Explain the operator decision, handoff context, or result that applies to every selected task."
            />
          </label>

          <div className="space-y-2">
            <label className="flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={confirmBulk}
                onChange={(event) => setConfirmBulk(event.target.checked)}
                className="mt-0.5 size-3.5 rounded border-line"
              />
              <span>
                I understand this will <span className="font-semibold text-ink">{bulkAction}</span> <span className="font-semibold text-ink">{selectedIssues.length}</span> selected issue{selectedIssues.length === 1 ? "" : "s"}.
              </span>
            </label>
            <button
              type="button"
              disabled={bulkPending || !canRunBulk}
              onClick={() => void onRunBulkAction(bulkAction, bulkNote.trim(), selectedIssues.map((issue) => issue.id))}
              className={cn(
                "w-full rounded-md px-3 py-2 text-xs font-semibold text-white transition-opacity",
                bulkPending || !canRunBulk ? "bg-[var(--accent)]/55" : "bg-[var(--accent)] hover:opacity-90",
              )}
            >
              {bulkPending ? "Applying…" : `Apply ${bulkAction}`}
            </button>
          </div>
        </div>

        <div className="mt-2 text-xs text-faint">{bulkGuardrail ?? "Selection is compatible and ready to run."}</div>

        {bulkFeedback && (
          <div
            className={cn(
              "mt-3 rounded-lg border px-3 py-2 text-xs",
              bulkFeedback.tone === "success" ? "border-ok/25 bg-ok/10 text-ok" : "border-danger/25 bg-danger/10 text-danger",
            )}
          >
            <div className="font-semibold">{bulkFeedback.summary}</div>
            {bulkFeedback.detail && <div className="mt-1 whitespace-pre-wrap">{bulkFeedback.detail}</div>}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {groupedIssues.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-6 text-center text-xs text-faint">
            No issues match the current search and filters.
          </div>
        ) : (
          groupedIssues.map((group) => (
            <section key={group.severity} className="rounded-lg border border-line bg-surface-2 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={TONE[group.severity]}>{group.severity}</Badge>
                  <span className="text-xs text-faint">{group.issues.length} issues</span>
                </div>
                <span className="text-[11px] text-faint">Sorted by production impact, then rank</span>
              </div>

              <ul className="space-y-2">
                {group.issues.map((issue) => {
                  const profileName = profileOptions.find((profile) => profile.id === issue.profile)?.name ?? issue.profile;
                  return (
                    <li key={issue.id} className="rounded-md border border-line bg-surface px-3 py-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint">
                          <label className="inline-flex items-center gap-2 text-muted">
                            <input
                              type="checkbox"
                              checked={selectedIssueIds.includes(issue.id)}
                              onChange={() => onToggleIssue(issue.id)}
                              aria-label={`Select issue ${issue.title} in ${profileName}`}
                              className="size-3.5 rounded border-line"
                            />
                            Select
                          </label>
                          <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5">{profileName}</span>
                          <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5">{issue.type}</span>
                          <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5">impact {issue.productionImpact}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenIssue(issue.profile, issue.id)}
                          className={cn(
                            "rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors",
                            "bg-[var(--accent)] text-white hover:opacity-90",
                          )}
                        >
                          Open in worker drawer
                        </button>
                      </div>
                      <HermesIssueDetail issue={issue} listItem={false} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
