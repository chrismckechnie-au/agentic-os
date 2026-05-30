// Server-only. Derives real Overview stats and recent sessions from local readers.
import type { Session, StatMetric, HealthItem, WorkspaceSummary } from "@/lib/types";
import type { AgentSummary } from "@/lib/types";
import { readSessions as readClaudeSessions } from "@/lib/claude-code/reader";
import { readSessions as readCodexSessions } from "@/lib/codex/reader";

export function buildOverviewStats(agents: AgentSummary[]): StatMetric[] {
  const claudeSessions = (() => { try { return readClaudeSessions(200); } catch { return []; } })();
  const codexSessions  = (() => { try { return readCodexSessions(200); } catch { return []; } })();

  const running   = agents.filter((a) => a.status === "running").length;
  const total     = agents.length;
  const activeSess = [...claudeSessions, ...codexSessions].filter(
    (s) => s.status === "active" || s.status === "in_progress",
  ).length;
  const completed = [...claudeSessions, ...codexSessions].filter(
    (s) => s.status === "completed",
  ).length;
  const workspaces = new Set(
    [...claudeSessions, ...codexSessions].map((s) => s.workspace).filter(Boolean),
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
      hint: `${claudeSessions.length + codexSessions.length} total sessions`,
      icon: "MessageSquare",
      spark: [Math.max(0, activeSess - 3), activeSess - 2, activeSess - 1, activeSess - 1, activeSess, activeSess, activeSess],
    },
    {
      id: "tasks-completed",
      label: "Tasks Completed",
      value: String(completed),
      hint: `${claudeSessions.filter((s) => s.group === "Today").length + codexSessions.filter((s) => s.group === "Today").length} today`,
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

export function buildWorkspaces(): WorkspaceSummary[] {
  const claude = (() => { try { return readClaudeSessions(200); } catch { return []; } })();
  const codex  = (() => { try { return readCodexSessions(200); } catch { return []; } })();

  const map = new Map<string, Set<string>>();
  for (const s of claude) {
    if (!s.workspace) continue;
    if (!map.has(s.workspace)) map.set(s.workspace, new Set());
    map.get(s.workspace)!.add("claude-code");
  }
  for (const s of codex) {
    if (!s.workspace) continue;
    if (!map.has(s.workspace)) map.set(s.workspace, new Set());
    map.get(s.workspace)!.add("codex");
  }

  return [...map.entries()]
    .map(([name, agentSet]) => ({ name, agents: agentSet.size }))
    .sort((a, b) => b.agents - a.agents);
}

export function buildRecentSessions(): Session[] {
  const claudeSessions = (() => { try { return readClaudeSessions(10); } catch { return []; } })();
  const codexSessions  = (() => { try { return readCodexSessions(10); } catch { return []; } })();

  const sessions: Session[] = [
    ...claudeSessions.slice(0, 5).map((s) => ({
      id: s.id,
      agentId: "claude-code" as const,
      title: s.title,
      workspace: s.workspace,
      status: s.status,
      updatedAt: s.updatedAt,
      group: s.group,
    })),
    ...codexSessions.slice(0, 5).map((s) => ({
      id: s.id,
      agentId: "codex" as const,
      title: s.title,
      workspace: s.workspace ?? undefined,
      status: s.status,
      updatedAt: s.updatedAt,
      group: s.group,
    })),
  ];

  // Sort by recency — "just now" < "Xm ago" < "Xh ago"
  const weight = (u: string) => {
    if (u === "just now") return 0;
    const m = u.match(/^(\d+)m/); if (m) return +m[1];
    const h = u.match(/^(\d+)h/); if (h) return +h[1] * 60;
    return 9999;
  };
  return sessions.sort((a, b) => weight(a.updatedAt) - weight(b.updatedAt)).slice(0, 6);
}
