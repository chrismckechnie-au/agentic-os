import type { AgentId, Note, VaultStats } from "@/lib/types";
import type { AgentPageData, DataProvider, OverviewData } from "@/lib/providers/types";
import { mockHermesCrewDashboard } from "@/lib/hermes/crew-core";
import { prepareNotes } from "@/lib/obsidian/parse";
import { filterNonCronSessions } from "@/lib/overview/session-filters";
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

function buildVaultStats(notes: Note[], vaultName: string): VaultStats {
  const tags = new Set<string>();
  let links = 0;
  let tasks = 0;
  let openTasks = 0;
  let unresolvedLinks = 0;

  for (const note of notes) {
    for (const tag of note.tags ?? []) tags.add(tag);
    links += note.outlinks?.length ?? 0;
    unresolvedLinks += note.outlinks?.filter((link) => !link.resolvedId).length ?? 0;
    tasks += note.taskCounts?.total ?? 0;
    openTasks += note.taskCounts?.open ?? 0;
  }

  return {
    notes: notes.length,
    links,
    vaultName,
    tags: tags.size,
    tasks,
    openTasks,
    unresolvedLinks,
  };
}

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
    const obsidianNotes = id === "obsidian" ? prepareNotes(OBSIDIAN_NOTES, "Refuelr") : undefined;
    const vaultStats = obsidianNotes ? buildVaultStats(obsidianNotes, "Refuelr") : undefined;
    return {
      agent,
      stats: AGENT_STATS[id],
      sessions: id === "hermes" ? filterNonCronSessions(SESSIONS[id]) : SESSIONS[id],
      activeSession: ACTIVE_SESSIONS[id],
      memory: id === "hermes" ? HERMES_MEMORY : undefined,
      skills: id === "hermes" ? HERMES_SKILLS : undefined,
      jobs: id === "hermes" ? HERMES_JOBS : undefined,
      hermesCrew: id === "hermes" ? mockHermesCrewDashboard(HERMES_TASKS, HERMES_JOBS) : undefined,
      notes: obsidianNotes,
      vaultStats,
    };
  }

  async listSessions(agentId?: AgentId) {
    if (agentId) {
      return agentId === "hermes" ? filterNonCronSessions(SESSIONS[agentId]) : SESSIONS[agentId];
    }
    return filterNonCronSessions((Object.keys(SESSIONS) as AgentId[]).flatMap((id) => SESSIONS[id]));
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

  async getHermesCrew() {
    return mockHermesCrewDashboard(HERMES_TASKS, HERMES_JOBS);
  }

  async createSession(agentId: AgentId, prompt: string) {
    // Mock write: pretend to create a session and return a fake id.
    console.info(`[mock] createSession(${agentId}): ${prompt.slice(0, 60)}`);
    return { id: `mock-${agentId}-${Date.now()}` };
  }
}
