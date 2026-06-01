// Server-only. Derives real Overview stats and recent sessions from local readers.
import type { Session, StatMetric, HealthItem, WorkspaceSummary } from "@/lib/types";
import type { AgentSummary } from "@/lib/types";
import { readLiveSessionSnapshot } from "@/lib/providers/live/session-snapshot";
import { formatBytes, type SystemResources } from "@/lib/system/resources";

function ratioPct(current: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

export function buildOverviewStats(
  agents: AgentSummary[],
  sessions: Session[] = readLiveSessionSnapshot().all,
  resources?: SystemResources,
): StatMetric[] {

  const running   = agents.filter((a) => a.status === "running").length;
  const total     = agents.length;
  const activeSess = sessions.filter(
    (s) => s.status === "active" || s.status === "in_progress",
  ).length;
  const workspaces = new Set(
    sessions.map((s) => s.workspace).filter(Boolean),
  ).size;

  const stats: StatMetric[] = [
    {
      id: "running-agents",
      label: "Running Agents",
      value: `${running} / ${total}`,
      hint: running > 0 ? `${running} agent${running > 1 ? "s" : ""} active` : "All agents idle",
      icon: "Activity",
      meterPct: ratioPct(running, total),
      meterLabel: `${running} of ${total} running`,
    },
  ];

  if (resources) {
    stats.push(
      {
        id: "host-cpu",
        label: "Host CPU",
        value: `${resources.cpuPct}%`,
        hint: `${resources.coreCount} logical core${resources.coreCount === 1 ? "" : "s"}`,
        icon: "Cpu",
        meterPct: resources.cpuPct,
        meterLabel: "Current system utilization",
      },
      {
        id: "host-memory",
        label: "Host RAM",
        value: `${resources.memoryPct}%`,
        hint: `${formatBytes(resources.usedMemoryBytes)} / ${formatBytes(resources.totalMemoryBytes)}`,
        icon: "MemoryStick",
        meterPct: resources.memoryPct,
        meterLabel: `${formatBytes(resources.freeMemoryBytes)} free`,
      },
    );
  }

  stats.push(
    {
      id: "active-sessions",
      label: "Active Sessions",
      value: String(activeSess),
      hint: `${sessions.length} total sessions`,
      icon: "MessageSquare",
      meterPct: ratioPct(activeSess, sessions.length),
      meterLabel: `${activeSess} of ${sessions.length} active`,
    },
    {
      id: "active-workspaces",
      label: "Active Workspaces",
      value: String(workspaces),
      hint: "Unique across all agents",
      icon: "FolderGit2",
    },
  );

  return stats;
}

function usageStatus(pct: number): HealthItem["status"] {
  if (pct >= 90) return "degraded";
  if (pct >= 75) return "running";
  return "healthy";
}

function usageDetail(label: "cpu" | "memory", pct: number): string {
  if (pct >= 90) return label === "cpu" ? `${pct}% - reduce host load` : `${pct}% - free memory`;
  if (pct >= 75) return `${pct}% - elevated`;
  return `${pct}%`;
}

export function buildSystemHealth(agents: AgentSummary[], resources?: SystemResources): HealthItem[] {
  const toHealth = (s: AgentSummary["status"]): HealthItem["status"] => {
    if (s === "running") return "running";
    if (s === "online") return "healthy";
    if (s === "degraded") return "degraded";
    return "down";
  };

  const resourceItems: HealthItem[] = resources
    ? [
        {
          label: "Host CPU",
          status: usageStatus(resources.cpuPct),
          detail: usageDetail("cpu", resources.cpuPct),
        },
        {
          label: "Host RAM",
          status: usageStatus(resources.memoryPct),
          detail: usageDetail("memory", resources.memoryPct),
        },
      ]
    : [];

  return [...resourceItems, ...agents.map((a) => ({
    label: a.name,
    status: toHealth(a.status),
    detail: a.currentTask ?? a.status,
  }))];
}

export function buildWorkspaces(
  sessions: Session[] = readLiveSessionSnapshot().all,
): WorkspaceSummary[] {
  const map = new Map<string, Set<string>>();
  for (const session of sessions) {
    if (!session.workspace) continue;
    if (!map.has(session.workspace)) map.set(session.workspace, new Set());
    map.get(session.workspace)?.add(session.agentId);
  }

  return [...map.entries()]
    .map(([name, agentSet]) => ({ name, agents: agentSet.size }))
    .sort((a, b) => b.agents - a.agents);
}

export function buildRecentSessions(
  sessions: Session[] = readLiveSessionSnapshot().all,
): Session[] {
  // Sort by recency — "just now" < "Xm ago" < "Xh ago"
  const weight = (u: string) => {
    if (u === "just now") return 0;
    const m = u.match(/^(\d+)m/); if (m) return +m[1];
    const h = u.match(/^(\d+)h/); if (h) return +h[1] * 60;
    return 9999;
  };
  return sessions.sort((a, b) => weight(a.updatedAt) - weight(b.updatedAt)).slice(0, 6);
}
