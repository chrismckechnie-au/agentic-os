import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { HermesCrewActionRecord, HermesCrewActivity, HermesCrewProfile } from "@/lib/types";
import { HermesIssueDetail } from "./issue-detail";

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
};

function toneFor(status: string): "ok" | "warn" | "danger" | "muted" | "info" {
  return STATUS_TONE[status] ?? "muted";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">{title}</span>
      </div>
      {children}
    </section>
  );
}

function OverviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="text-faint">{label}</span>
      <span className="text-right text-muted">{value}</span>
    </div>
  );
}

function ActivityItem({ item }: { item: HermesCrewActivity }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon name={item.source === "cron" ? "Clock" : item.source === "kanban" ? "SquareKanban" : "CircleDot"} size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-muted">{item.title}</span>
        <span className="block text-faint">{item.when}</span>
        {item.summary && <span className="mt-1 block line-clamp-2 text-faint">{item.summary}</span>}
      </span>
      {item.status && <Badge tone={toneFor(item.status)}>{item.status}</Badge>}
    </li>
  );
}

function ActionItem({ action }: { action: HermesCrewActionRecord }) {
  return (
    <li className="rounded-md border border-line bg-surface px-3 py-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-muted">{action.summary}</div>
          <div className="mt-1 text-faint">{action.when} · {action.actor}</div>
          {action.note && <div className="mt-1 line-clamp-2 text-faint">{action.note}</div>}
        </div>
        <Badge tone={action.outcome === "failure" ? "danger" : "ok"}>{action.outcome}</Badge>
      </div>
    </li>
  );
}

export function HermesWorkerDetailPanel({
  profile,
  activity,
  focusedIssueId,
  onFocusIssue,
  disableIssueFocus = false,
}: {
  profile: HermesCrewProfile;
  activity: HermesCrewActivity[];
  focusedIssueId?: string;
  onFocusIssue?: (issueId: string) => void;
  disableIssueFocus?: boolean;
}) {
  const workerActivity = activity.filter((item) => item.profile === profile.id || item.role === profile.role).slice(0, 5);
  const recentActions = profile.recentActions.slice(0, 5);

  return (
    <div className="space-y-3">
      <Section title="Overview">
        <div className="divide-y divide-line">
          <OverviewRow label="Top issue" value={profile.topIssueTitle ?? "No active issues"} />
          <OverviewRow label="Open tasks" value={profile.openTasks} />
          <OverviewRow label="Running tasks" value={profile.runningTasks} />
          <OverviewRow label="Blocked tasks" value={profile.scorecard.blockedTasks} />
          <OverviewRow label="Failed jobs" value={profile.scorecard.failedJobs} />
          <OverviewRow
            label="Private channel"
            value={<span className={cn(profile.privateChannel.available ? "text-muted" : "text-danger")}>#{profile.privateChannel.name}</span>}
          />
        </div>
      </Section>

      <Section title="Issues">
        {profile.issues.length === 0 ? (
          <div className="rounded-md border border-line bg-surface px-3 py-4 text-xs text-faint">No active issues for this worker.</div>
        ) : (
          <ul className="space-y-2">
            {profile.issues.map((issue) => (
              <HermesIssueDetail
                key={issue.id}
                issue={issue}
                selected={issue.id === focusedIssueId}
                disabled={disableIssueFocus}
                onSelect={onFocusIssue}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Activity">
        {workerActivity.length === 0 ? (
          <div className="rounded-md border border-line bg-surface px-3 py-4 text-xs text-faint">No recent worker activity detected.</div>
        ) : (
          <ul className="space-y-2">
            {workerActivity.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Actions">
        {recentActions.length === 0 ? (
          <div className="rounded-md border border-line bg-surface px-3 py-4 text-xs text-faint">No operator actions recorded yet for this worker.</div>
        ) : (
          <ul className="space-y-2">
            {recentActions.map((action) => (
              <ActionItem key={action.id} action={action} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
