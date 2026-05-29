import type { TaskStatus } from "@/lib/types";

// Board columns in Hermes pipeline order. `archived` is intentionally excluded
// (hidden behind a filter), matching how a kanban board normally hides it.
export interface KanbanColumn {
  status: TaskStatus;
  label: string;
  /** Header dot / count color. */
  color: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { status: "triage", label: "Triage", color: "#6b7280" },
  { status: "todo", label: "To Do", color: "#9aa1ad" },
  { status: "scheduled", label: "Scheduled", color: "#60a5fa" },
  { status: "ready", label: "Ready", color: "#a78bfa" },
  { status: "running", label: "Running", color: "#34d399" },
  { status: "blocked", label: "Blocked", color: "#f59e0b" },
  { status: "review", label: "Review", color: "#c084fc" },
  { status: "done", label: "Done", color: "#10b981" },
];

// Priority pill metadata (kanban_db.py `priority` INTEGER, 0..3).
export const PRIORITY_META: Record<number, { label: string; className: string }> = {
  1: { label: "P1", className: "text-muted bg-surface-3 border-line" },
  2: { label: "P2", className: "text-warn bg-warn/12 border-warn/25" },
  3: { label: "P3", className: "text-danger bg-danger/12 border-danger/25" },
};
