import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HermesCrewIssue } from "@/lib/types";

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

export function HermesIssueDetail({
  issue,
  selected = false,
  disabled = false,
  listItem = true,
  onSelect,
}: {
  issue: HermesCrewIssue;
  selected?: boolean;
  disabled?: boolean;
  listItem?: boolean;
  onSelect?: (issueId: string) => void;
}) {
  const interactive = Boolean(onSelect);
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{issue.title}</span>
            <Badge tone={toneFor(issue.severity)}>{issue.severity}</Badge>
            <Badge tone="muted">{issue.type}</Badge>
            {issue.status && <Badge tone={toneFor(issue.status)}>{issue.status}</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted">{issue.plainEnglish}</p>
        </div>
        <span className="shrink-0 text-[11px] font-mono text-faint">#{issue.rank}</span>
      </div>

      <div className="mt-2 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[11px] text-faint">
        <div className="font-medium text-muted">Recommended action</div>
        {issue.recommendedAction ? (
          <>
            <div className="mt-1 text-ink">{issue.recommendedAction.label}</div>
            {issue.recommendedAction.summary && <div className="mt-1">{issue.recommendedAction.summary}</div>}
          </>
        ) : (
          <div className="mt-1">No direct action suggested yet.</div>
        )}
      </div>

      {issue.affectedObjects.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {issue.affectedObjects.slice(0, 6).map((obj) => (
            <span key={`${issue.id}:${obj.kind}:${obj.id}`} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-faint">
              {obj.kind}: {obj.label}
            </span>
          ))}
        </div>
      )}

      {(issue.summary || issue.rawDetail) && (
        <details className="mt-2 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[11px] text-faint">
          <summary className="cursor-pointer select-none font-medium text-muted">Evidence</summary>
          {issue.summary && <div className="mt-2 whitespace-pre-wrap text-muted">{issue.summary}</div>}
          {issue.rawDetail && issue.rawDetail !== issue.summary && <div className="mt-2 whitespace-pre-wrap">{issue.rawDetail}</div>}
        </details>
      )}
    </>
  );

  if (!interactive) {
    const className = cn("rounded-md border border-line bg-surface px-3 py-2.5", selected && "border-[var(--accent)] bg-[var(--accent-soft)]/25");
    return listItem ? <li className={className}>{content}</li> : <div className={className}>{content}</div>;
  }

  const button = (
    <button
      type="button"
      onClick={() => onSelect?.(issue.id)}
      disabled={disabled}
      className={cn(
        "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-[var(--accent)]/45 hover:bg-surface-2/70 disabled:cursor-not-allowed disabled:opacity-75",
        selected && "border-[var(--accent)] bg-[var(--accent-soft)]/25 shadow-[inset_0_0_0_1px_var(--accent-line)]",
      )}
      aria-pressed={selected}
    >
      {content}
    </button>
  );

  return listItem ? <li>{button}</li> : button;
}
