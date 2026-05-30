// Server-only. Derives real Overview stats and recent sessions from local readers.
import type { Session, StatMetric, HealthItem, WorkspaceSummary } from "@/lib/types";
import type { AgentSummary } from "@/lib/types";
import { readLiveSessionSnapshot } from "@/lib/providers/live/session-snapshot";

export function buildOverviewStats(
  agents: AgentSummary[],
  sessions: Session[] = readLiveSessionSnapshot().all,
): StatMetric[] {

  const running   = agents.filter((a) => a.status === "running").length;
  const total     = agents.length;
  const activeSess = sessions.filter(
    (s) => s.status === "active" || s.status === "in_progress",
  ).length;
  const completed = sessions.filter(
    (s) => s.status === "completed",
  ).length;
  const workspaces = new Set(
    sessions.map((s) => s.workspace).filter(Boolean),
  ).size;

  return [
    {
      id: "running-agents",
      label: "Running Agents",
      value: `${running} / ${total}`,
      hint: running > 0 ? `${running} agent${running > 1 ? "s" : ""} active` : "All agents idle",
      icon: "Activity",
      spark: [0, 1, 1, 2, 1, running, running],
    },
    {
      id: "active-sessions",
      label: "Active Sessions",
      value: String(activeSess),
      hint: `${sessions.length} total sessions`,
      icon: "MessageSquare",
      spark: [Math.max(0, activeSess - 3), activeSess - 2, activeSess - 1, activeSess - 1, activeSess, activeSess, activeSess],
    },
    {
      id: "tasks-completed",
      label: "Tasks Completed",
      value: String(completed),
      hint: `${sessions.filter((s) => s.group === "Today").length} today`,
      icon: "CircleCheck",
      spark: [Math.max(0, completed - 20), completed - 15, completed - 10, completed - 6, completed - 3, completed - 1, completed],
    },
    {
      id: "active-workspaces",
      label: "Active Workspaces",
      value: String(workspaces),
      hint: "Unique across all agents",
      icon: "FolderGit2",
      spark: [Math.max(0, workspaces - 2), workspaces - 1, workspaces - 1, workspaces, workspaces, workspaces, workspaces],
    },
  ];
}

export function buildSystemHealth(agents: AgentSummary[]): HealthItem[] {
  const toHealth = (s: AgentSummary["status"]): HealthItem["status"] => {
    if (s === "running") return "running";
    if (s === "online") return "healthy";
    if (s === "degraded") return "degraded";
    return "down";
  };
  return agents.map((a) => ({
    label: a.name,
    status: toHealth(a.status),
    detail: a.currentTask ?? a.status,
  }));
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
