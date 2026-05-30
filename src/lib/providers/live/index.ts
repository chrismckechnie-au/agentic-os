import "server-only";

import { AGENTS } from "@/lib/config/agents";
import type { DataProvider, OverviewData, AgentPageData } from "@/lib/providers/types";
import type { ActivityItem, AgentId, AgentSummary, HealthItem, Session, SessionDetail } from "@/lib/types";
import { buildActivity } from "@/lib/activity/real";
import { buildAgentSummaries } from "@/lib/agents/detect";
import {
  buildClaudeStats,
  buildCodexStats,
  buildHermesStats,
  buildObsidianStats,
} from "@/lib/agents/stats";
import { buildOverviewStats, buildRecentSessions, buildSystemHealth, buildWorkspaces } from "@/lib/overview/real";
import { readSessionDetail as readClaudeDetail } from "@/lib/claude-code/reader";
import { readSessionDetail as readCodexDetail } from "@/lib/codex/reader";
import { hermesAvailable, readJobs, readMemory, readSkills } from "@/lib/hermes/reader";
import {
  getStateDbHealth,
  readSessionDetail as readHermesDetail,
} from "@/lib/hermes/state";
import { readVaultStats } from "@/lib/obsidian/reader";
import { listRepos, getRepo } from "@/lib/providers/live/github";
import { listNotes, noteToDetail, noteToSession } from "@/lib/providers/live/obsidian";
import { readTasks } from "@/lib/providers/live/hermes-kanban";
import { HERMES_TASKS } from "@/lib/providers/mock/data";
import { readLiveSessionSnapshot, toBaseSession } from "@/lib/providers/live/session-snapshot";

function emptySessionDetail(agentId: AgentId, title: string, workspace?: string): SessionDetail {
  return {
    id: `${agentId}-empty`,
    agentId,
    title,
    workspace,
    status: "completed",
    updatedAt: "—",
    group: "Unavailable",
    transcript: [{ role: "system", kind: "info", text: title }],
  };
}

export class LiveProvider implements DataProvider {
  async getOverview(): Promise<OverviewData> {
    const snapshot = readLiveSessionSnapshot();
    const agents = buildAgentSummaries(snapshot);
    return {
      stats: buildOverviewStats(agents, snapshot.all),
      agents,
      recentSessions: buildRecentSessions(snapshot.all),
      health: buildSystemHealth(agents),
      activity: buildActivity(6, snapshot),
      workspaces: buildWorkspaces(snapshot.all),
    };
  }

  async listAgents(): Promise<AgentSummary[]> {
    return buildAgentSummaries(readLiveSessionSnapshot());
  }

  async getAgentPage(id: AgentId): Promise<AgentPageData> {
    const snapshot = readLiveSessionSnapshot();
    const agent = buildAgentSummaries(snapshot).find((entry) => entry.id === id) ?? {
      id,
      name: AGENTS[id].name,
      tagline: AGENTS[id].tagline,
      status: "offline" as const,
      liveCliAvailable: false,
      lastSessionAgo: "—",
      currentTask: "Unavailable",
      workspace: "—",
    };

    if (id === "claude-code") {
      const sessions = snapshot.claude.slice(0, 100).map(toBaseSession);
      return {
        agent,
        stats: buildClaudeStats(snapshot.claude),
        sessions,
        activeSession:
          sessions.length > 0 ? readClaudeDetail(sessions[0].id) ?? emptySessionDetail(id, "Unable to read Claude session detail") : emptySessionDetail(id, "No Claude sessions found"),
      };
    }

    if (id === "codex") {
      const sessions = snapshot.codex.slice(0, 100).map(toBaseSession);
      return {
        agent,
        stats: buildCodexStats(snapshot.codex),
        sessions,
        activeSession:
          sessions.length > 0 ? readCodexDetail(sessions[0].id) ?? emptySessionDetail(id, "Unable to read Codex session detail") : emptySessionDetail(id, "No Codex sessions found"),
      };
    }

    if (id === "hermes") {
      const health = getStateDbHealth();
      const sessions = health.readable ? snapshot.hermes.slice(0, 100) : [];
      const stats = buildHermesStats();
      return {
        agent,
        stats,
        sessions,
        activeSession:
          sessions.length > 0
            ? readHermesDetail(sessions[0].id) ?? emptySessionDetail(id, "Unable to read Hermes session detail")
            : emptySessionDetail(
                id,
                health.available && !health.readable ? health.reason ?? "Hermes state is unreadable" : "No Hermes sessions found",
                hermesAvailable() ? "hermes-agent" : undefined,
              ),
        memory: hermesAvailable() ? readMemory() : undefined,
        skills: hermesAvailable() ? readSkills() : undefined,
        jobs: hermesAvailable() ? readJobs() : undefined,
      };
    }

    const notes = await listNotes();
    const vault = readVaultStats();
    const sessions = notes.map(noteToSession);
    return {
      agent,
      stats: buildObsidianStats(),
      sessions,
      activeSession: notes[0] ? noteToDetail(notes[0]) : emptySessionDetail(id, "No notes found", vault.vaultName),
      notes,
    };
  }

  async listSessions(agentId?: AgentId): Promise<Session[]> {
    const snapshot = readLiveSessionSnapshot();
    if (agentId === "claude-code") return snapshot.claude.map(toBaseSession);
    if (agentId === "codex") return snapshot.codex.map(toBaseSession);
    if (agentId === "hermes") {
      const health = getStateDbHealth();
      return health.readable ? snapshot.hermes : [];
    }
    if (agentId === "obsidian") {
      return snapshot.obsidian;
    }

    return snapshot.all;
  }

  async listRepos() {
    return listRepos();
  }

  async getRepo(owner: string, name: string) {
    return getRepo(owner, name);
  }

  async listActivity(): Promise<ActivityItem[]> {
    return buildActivity(8, readLiveSessionSnapshot());
  }

  async listHealth(): Promise<HealthItem[]> {
    return buildSystemHealth(buildAgentSummaries());
  }

  async getKanban() {
    try {
      return readTasks();
    } catch {
      return HERMES_TASKS;
    }
  }

  async createSession(agentId: AgentId, prompt: string): Promise<{ id: string }> {
    void agentId;
    void prompt;
    throw new Error("Live session creation is not enabled; use the PTY route instead.");
  }
}
