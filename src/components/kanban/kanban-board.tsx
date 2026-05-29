import { KANBAN_COLUMNS } from "@/lib/config/kanban";
import type { KanbanTask } from "@/lib/types";
import { TaskCard } from "./task-card";

export function KanbanBoard({ tasks }: { tasks: KanbanTask[] }) {
  // Archived is excluded from the board.
  const byStatus = new Map<string, KanbanTask[]>();
  for (const t of tasks) {
    if (t.status === "archived") continue;
    if (!byStatus.has(t.status)) byStatus.set(t.status, []);
    byStatus.get(t.status)!.push(t);
  }
  // Higher priority first within a column.
  for (const list of byStatus.values()) list.sort((a, b) => b.priority - a.priority);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((col) => {
        const items = byStatus.get(col.status) ?? [];
        return (
          <section key={col.status} className="flex w-[300px] shrink-0 flex-col">
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="size-2 rounded-full" style={{ background: col.color }} />
              <h2 className="text-sm font-semibold text-ink">{col.label}</h2>
              <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-medium text-faint">
                {items.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 rounded-xl border border-line/60 bg-surface/40 p-2">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-faint/60">No tasks</p>
              ) : (
                items.map((t) => <TaskCard key={t.id} task={t} />)
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
