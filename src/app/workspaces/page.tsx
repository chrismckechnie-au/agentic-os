export const dynamic = "force-dynamic";

import { buildWorkspaces } from "@/lib/overview/real";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";

export default function WorkspacesPage() {
  const workspaces = buildWorkspaces();

  return (
    <>
      <PageHeader
        title="Workspaces"
        subtitle="Project workspaces and the agents attached to each."
        icon="Boxes"
      />
      {workspaces.length === 0 ? (
        <p className="text-sm text-faint">No workspaces detected yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((w) => (
            <Card key={w.name} className="flex items-center justify-between p-5 transition-colors hover:border-line-strong">
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
