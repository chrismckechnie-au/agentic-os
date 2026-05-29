import type { AgentId } from "@/lib/types";
import type { AgentPageData, DataProvider, OverviewData } from "@/lib/providers/types";
import {
  ACTIVE_SESSIONS,
  ACTIVITY,
  AGENT_STATS,
  AGENTS_SUMMARY,
  HEALTH,
  HERMES_JOBS,
  HERMES_MEMORY,
  HERMES_SKILLS,
  HERMES_TASKS,
  OBSIDIAN_NOTES,
  OVERVIEW_STATS,
  REPOS,
  SESSIONS,
  WORKSPACES,
} from "./data";

/** Read-only provider backed by static fixtures. */
export class MockProvider implements DataProvider {
  async getOverview(): Promise<OverviewData> {
    const recentSessions = AGENTS_SUMMARY.flatMap((a) => SESSIONS[a.id].slice(0, 2))
      .sort(() => 0) // keep stable order
      .slice(0, 6);
    return {
      stats: OVERVIEW_STATS,
      agents: AGENTS_SUMMARY,
      recentSessions,
      health: HEALTH,
      activity: ACTIVITY,
      workspaces: WORKSPACES,
    };
  }

  async listAgents() {
    return AGENTS_SUMMARY;
  }

  async getAgentPage(id: AgentId): Promise<AgentPageData> {
    const agent = AGENTS_SUMMARY.find((a) => a.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    return {
      agent,
      stats: AGENT_STATS[id],
      sessions: SESSIONS[id],
      activeSession: ACTIVE_SESSIONS[id],
      memory: id === "hermes" ? HERMES_MEMORY : undefined,
      skills: id === "hermes" ? HERMES_SKILLS : undefined,
      jobs: id === "hermes" ? HERMES_JOBS : undefined,
      notes: id === "obsidian" ? OBSIDIAN_NOTES : undefined,
    };
  }

  async listSessions(agentId?: AgentId) {
    if (agentId) return SESSIONS[agentId];
    return (Object.keys(SESSIONS) as AgentId[]).flatMap((id) => SESSIONS[id]);
  }

  async listRepos() {
    return REPOS;
  }

  async getRepo(owner: string, name: string) {
    return REPOS.find((r) => r.owner === owner && r.name === name) ?? null;
  }

  async listActivity() {
    return ACTIVITY;
  }

  async listHealth() {
    return HEALTH;
  }

  async getKanban() {
    return HERMES_TASKS;
  }

  async createSession(agentId: AgentId, prompt: string) {
    // Mock write: pretend to create a session and return a fake id.
    console.info(`[mock] createSession(${agentId}): ${prompt.slice(0, 60)}`);
    return { id: `mock-${agentId}-${Date.now()}` };
  }
}
