import type { CSSProperties } from "react";
import { getKanbanTasks } from "@/lib/providers";
import { AGENTS } from "@/lib/config/agents";
import { PageHeader } from "@/components/dashboard/page-header";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { Icon } from "@/components/icon";

const ACCENT = AGENTS.hermes.accent;

// Always read fresh (live DB may change between requests).
export const dynamic = "force-dynamic";

function accentStyle(hex: string): CSSProperties {
  return {
    ["--accent" as string]: hex,
    ["--accent-soft" as string]: `color-mix(in srgb, ${hex} 16%, transparent)`,
    ["--accent-line" as string]: `color-mix(in srgb, ${hex} 38%, transparent)`,
  };
}

export default async function KanbanPage() {
  const { tasks, source, dbPath, boardSlug, resolution, reason } = await getKanbanTasks();
  const active = tasks.filter((t) => t.status !== "archived");
  const running = active.filter((t) => t.status === "running").length;
  const blocked = active.filter((t) => t.status === "blocked").length;
  const done = active.filter((t) => t.status === "done").length;
  const live = source === "live";
  const degraded = source === "degraded";

  return (
    <div style={accentStyle(ACCENT)}>
      <PageHeader
        title="Kanban"
        subtitle="Hermes task pipeline — goals decomposed into tasks and worked by the swarm."
        icon="SquareKanban"
        accent={ACCENT}
        right={
          <div className="flex items-center gap-4 text-sm">
            <span
              className={
                live
                  ? "flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2 py-0.5 text-[11px] font-semibold text-ok"
                  : degraded
                    ? "flex items-center gap-1.5 rounded-full border border-warn/25 bg-warn/10 px-2 py-0.5 text-[11px] font-semibold text-warn"
                  : "flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted"
              }
            >
              <span
                className={`size-1.5 rounded-full ${live ? "bg-ok animate-pulse" : degraded ? "bg-warn" : "bg-faint"}`}
              />
              {live ? "LIVE" : degraded ? "DEGRADED" : "DEMO"}
            </span>
            <Stat label="Tasks" value={active.length} />
            <Stat label="Running" value={running} dot="#34d399" />
            <Stat label="Blocked" value={blocked} dot="#f59e0b" />
            <Stat label="Done" value={done} dot="#10b981" />
          </div>
        }
      />

      <KanbanBoard tasks={tasks} />

      <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
        <Icon name="Activity" size={12} />
        {live ? (
          <>
            Live · reading <code className="font-mono text-[var(--accent)]">{dbPath}</code> · archived hidden
            {boardSlug ? ` · board ${boardSlug}` : ""}
          </>
        ) : degraded ? (
          <>
            Degraded · reading <code className="font-mono text-[var(--accent)]">{dbPath}</code> failed
            {boardSlug ? ` · board ${boardSlug}` : ""} · {resolution}
            {reason ? ` · ${reason}` : ""} · archived hidden
          </>
        ) : (
          <>
            Demo data · create <code className="font-mono text-[var(--accent)]">{dbPath}</code> (or set{" "}
            <code className="font-mono text-[var(--accent)]">HERMES_KANBAN_DB</code>) to go live · archived hidden
            {reason ? ` · ${reason}` : ""}
          </>
        )}
      </p>
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {dot && <span className="size-1.5 rounded-full" style={{ background: dot }} />}
      <span className="font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-faint">{label}</span>
    </span>
  );
}
