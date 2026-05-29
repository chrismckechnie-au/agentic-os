import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { PRIORITY_META } from "@/lib/config/kanban";
import type { KanbanTask } from "@/lib/types";

export function TaskCard({ task }: { task: KanbanTask }) {
  const running = task.status === "running";
  const blocked = task.status === "blocked";
  const prio = PRIORITY_META[task.priority];
  const timeLabel = running && task.runtime ? task.runtime : task.completedAt ?? task.createdAt;

  return (
    <article
      className={cn(
        "rounded-lg border bg-surface-2 p-3 transition-colors hover:border-line-strong",
        running ? "border-[var(--accent-line)] ring-1 ring-[var(--accent)]/30" : "border-line",
        blocked && "border-l-2 border-l-warn",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-faint">{task.id}</span>
        {prio && (
          <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", prio.className)}>
            {prio.label}
          </span>
        )}
      </div>

      <h3 className="mt-1 text-sm font-medium leading-snug text-ink">{task.title}</h3>
      {task.body && <p className="mt-1 line-clamp-2 text-xs text-faint">{task.body}</p>}

      {task.skills && task.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.skills.map((s) => (
            <span key={s} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">
              {s}
            </span>
          ))}
        </div>
      )}

      {(task.branchName || task.workspaceKind) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-faint">
          {task.branchName && (
            <span className="flex items-center gap-1 truncate">
              <Icon name="GitBranch" size={12} /> {task.branchName}
            </span>
          )}
          {task.workspaceKind && task.workspaceKind !== "scratch" && (
            <span className="flex items-center gap-1">
              <Icon name="FolderGit2" size={12} /> {task.workspaceKind}
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[11px] text-faint">
        <span className="flex items-center gap-2.5">
          {task.assignee ? (
            <span className="flex items-center gap-1">
              <span className="grid size-4 place-items-center rounded-full bg-surface-3 text-[8px] font-bold text-muted">
                {task.assignee.slice(0, 1).toUpperCase()}
              </span>
              {task.assignee}
            </span>
          ) : (
            <span className="text-faint/70">unassigned</span>
          )}
          {typeof task.deps === "number" && task.deps > 0 && (
            <span className="flex items-center gap-1">
              <Icon name="Link2" size={12} /> {task.deps}
            </span>
          )}
        </span>

        <span className="flex items-center gap-2">
          {task.consecutiveFailures ? (
            <span className="flex items-center gap-1 font-medium text-danger">
              <Icon name="CircleDot" size={11} /> {task.consecutiveFailures} fails
            </span>
          ) : null}
          <span className={cn("flex items-center gap-1", running && "text-ok")}>
            {running && <Icon name="Clock" size={11} />}
            {timeLabel}
          </span>
        </span>
      </div>
    </article>
  );
}
