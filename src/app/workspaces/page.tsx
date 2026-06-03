export const dynamic = "force-dynamic";

import { buildWorkspaces } from "@/lib/overview/real";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";

export default function WorkspacesPage() {
  const workspaces = buildWorkspaces();
  const totalAgents = workspaces.reduce((sum, workspace) => sum + workspace.agents, 0);

  return (
    <>
      <PageHeader
        title="Workspaces"
        subtitle="Project workspaces and the agents attached to each."
        icon="Boxes"
      />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Workspaces" value={workspaces.length} icon="Boxes" />
        <MetricTile label="Attached agents" value={totalAgents} icon="Orbit" />
        <MetricTile label="Single-agent" value={workspaces.filter((workspace) => workspace.agents === 1).length} icon="UserRound" />
        <MetricTile label="Shared lanes" value={workspaces.filter((workspace) => workspace.agents > 1).length} icon="UsersRound" />
      </div>
      {workspaces.length === 0 ? (
        <p className="text-sm text-faint">No workspaces detected yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((w) => (
            <Card key={w.name} className="panel-hover flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface-2 text-[var(--accent)]">
                  <Icon name="FolderGit2" size={18} />
                </span>
                <div>
                  <p className="font-semibold text-ink">{w.name}</p>
                  <p className="text-xs text-faint">
                    {w.agents} agent{w.agents === 1 ? "" : "s"} active
                  </p>
                </div>
              </div>
              <Icon name="ArrowRight" size={16} className="text-faint" />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function MetricTile({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="tile px-4 py-3">
      <div className="flex items-center gap-2 text-[var(--color-faint)]">
        <Icon name={icon} size={14} className="text-[var(--accent)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 text-[26px] font-[660] leading-none tabular-nums text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
