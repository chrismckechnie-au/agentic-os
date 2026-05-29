import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { AGENTS } from "@/lib/config/agents";
import type { AgentSummary } from "@/lib/types";

export function AgentCard({ agent }: { agent: AgentSummary }) {
  const cfg = AGENTS[agent.id];
  const live = agent.status === "running";

  return (
    <Link href={`/agents/${agent.id}`} className="block">
      <Card className="p-5 transition-colors hover:border-line-strong">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 place-items-center rounded-lg border border-line"
              style={{ color: cfg.accent, background: `color-mix(in srgb, ${cfg.accent} 14%, transparent)` }}
            >
              <Icon name={cfg.icon} size={18} />
            </span>
            <span className="font-semibold">{agent.name}</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-ok">
            <span className="size-2 rounded-full bg-ok" />
            {live ? "Running" : "Online"}
          </span>
        </div>

        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex items-center gap-2">
            <dt className="w-28 shrink-0 text-faint">Workspace</dt>
            <dd className="flex items-center gap-1.5 text-ink">
              <Icon name="FolderGit2" size={14} className="text-muted" />
              {agent.workspace}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-faint">Current Task</dt>
            <dd className="text-muted">{agent.currentTask}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <Badge tone="info">
            <span className="size-1.5 rounded-full bg-current" />
            In Progress
          </Badge>
        </div>
      </Card>
    </Link>
  );
}
