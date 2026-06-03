import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { HERMES_CREW_ROLE_LABELS } from "@/lib/config/hermes-crew";
import { cn } from "@/lib/utils";
import type { HermesCrewProfile } from "@/lib/types";

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

function roleIcon(role: HermesCrewProfile["role"]): string {
  switch (role) {
    case "incidents":
      return "ShieldCheck";
    case "social":
      return "SendHorizontal";
    case "research":
      return "Search";
    case "engineering":
      return "Wrench";
    default:
      return "Workflow";
  }
}

export function HermesWorkerCard({
  profile,
  selected,
  onSelect,
}: {
  profile: HermesCrewProfile;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "tile min-w-0 p-3 text-left transition-colors hover:border-[var(--accent)]/45 hover:bg-surface-2/70",
        selected && "border-[var(--accent)] bg-[var(--accent-soft)]/40 shadow-[inset_0_0_0_1px_var(--accent-line)]",
      )}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{profile.name}</span>
            <Badge tone={toneFor(profile.status)}>{profile.status}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-faint">{HERMES_CREW_ROLE_LABELS[profile.role]}</p>
        </div>
        <Icon name={roleIcon(profile.role)} size={16} className="shrink-0 text-[var(--accent)]" />
      </div>

      <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-4 text-muted">{profile.description}</p>

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5">
          <div className="text-sm font-semibold text-ink">{profile.openTasks}</div>
          <div className="text-[10px] text-faint">open</div>
        </div>
        <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5">
          <div className="text-sm font-semibold text-ink">{profile.runningTasks}</div>
          <div className="text-[10px] text-faint">running</div>
        </div>
        <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5">
          <div className={cn("text-sm font-semibold", profile.issueCount > 0 ? "text-warn" : "text-ink")}>
            {profile.issueCount}
          </div>
          <div className="text-[10px] text-faint">issues</div>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-faint">priority</span>
          <span className="min-w-0 truncate text-right font-medium text-muted">{profile.prioritySummary}</span>
        </div>
        {profile.topIssueTitle && <div className="mt-1 line-clamp-2 text-faint">{profile.topIssueTitle}</div>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-faint">
        <span className="truncate font-mono">#{profile.privateChannel.name}</span>
        <span className="font-medium text-[var(--accent)]">View issues</span>
      </div>
    </button>
  );
}
