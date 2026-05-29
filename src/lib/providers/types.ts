import type {
  ActivityItem,
  AgentId,
  AgentSummary,
  HealthItem,
  Job,
  KanbanTask,
  MemoryStore,
  Note,
  Repo,
  Session,
  SessionDetail,
  Skill,
  StatMetric,
  WorkspaceSummary,
} from "@/lib/types";

// The data the Overview page needs.
export interface OverviewData {
  stats: StatMetric[];
  agents: AgentSummary[];
  recentSessions: Session[];
  health: HealthItem[];
  activity: ActivityItem[];
  workspaces: WorkspaceSummary[];
}

// Everything an agent workspace page needs.
export interface AgentPageData {
  agent: AgentSummary;
  stats: StatMetric[];
  sessions: Session[];
  activeSession: SessionDetail;
  // agent-specific extras (only populated where relevant)
  memory?: MemoryStore[];
  skills?: Skill[];
  jobs?: Job[];
  notes?: Note[];
}

/**
 * The single seam between the UI and any data source.
 *
 * Today the only implementation is the MockProvider. To go live on the Ubuntu
 * box, implement these same methods against real sources (see ./live/*) and
 * flip DATA_SOURCE=live — no UI or route changes required.
 */
export interface DataProvider {
  getOverview(): Promise<OverviewData>;
  listAgents(): Promise<AgentSummary[]>;
  getAgentPage(id: AgentId): Promise<AgentPageData>;
  listSessions(agentId?: AgentId): Promise<Session[]>;
  listRepos(): Promise<Repo[]>;
  getRepo(owner: string, name: string): Promise<Repo | null>;
  listActivity(): Promise<ActivityItem[]>;
  listHealth(): Promise<HealthItem[]>;
  /** Hermes kanban task pipeline. */
  getKanban(): Promise<KanbanTask[]>;
  /** Write path: start a new session bound to an agent. Stubbed in mock mode. */
  createSession(agentId: AgentId, prompt: string): Promise<{ id: string }>;
}
