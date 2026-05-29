// Domain types for Agentic OS. These describe the shape of data the UI renders,
// independent of where it comes from (mock fixtures now, real sources later).

export type AgentId = "claude-code" | "codex" | "hermes" | "obsidian";

export type SessionStatus =
  | "active"
  | "running"
  | "completed"
  | "in_progress"
  | "reviewing"
  | "paused"
  | "queued"
  | "failed";

export type HealthStatus = "healthy" | "degraded" | "down" | "running";

export interface StatMetric {
  id: string;
  label: string;
  value: string;
  /** Sub-label, e.g. "All agents online". */
  hint?: string;
  /** Delta caption, e.g. "+18% vs last 7 days". */
  delta?: string;
  trend?: "up" | "down" | "flat";
  /** Sparkline series for the card. */
  spark?: number[];
  /** Lucide icon key (see components/icon.tsx). */
  icon?: string;
}

export interface SessionMessage {
  role: "user" | "agent" | "system";
  /** Visual kind for terminal rendering. */
  kind?: "info" | "step" | "output" | "skill" | "job" | "prompt" | "success" | "error";
  text: string;
  ts?: string;
}

export interface Session {
  id: string;
  agentId: AgentId;
  title: string;
  workspace?: string;
  status: SessionStatus;
  /** Relative label, e.g. "2m ago". */
  updatedAt: string;
  /** Sidebar grouping, e.g. "Today" | "Yesterday" | "Previous 7 days". */
  group?: string;
}

export interface Commit {
  sha: string;
  message: string;
  when: string;
}

export interface FileTouched {
  name: string;
  /** File-type label, e.g. "TS", "SQL". */
  kind: string;
  change?: "A" | "M" | "D";
}

export interface SessionDetail extends Session {
  branch?: string;
  model?: string;
  startedAt?: string;
  transcript: SessionMessage[];
  tokensIn?: number;
  tokensOut?: number;
  totalTokens?: number;
  contextPct?: number;
  filesTouched?: FileTouched[];
  commits?: Commit[];
  estimate?: string;
  sandbox?: string;
  permissions?: string;
  /** Codex/agents plan checklist. */
  plan?: { label: string; done: boolean; current?: boolean }[];
}

export interface HealthItem {
  label: string;
  status: HealthStatus;
  detail?: string;
}

export interface ActivityItem {
  id: string;
  icon: string;
  text: string;
  when: string;
  agentId?: AgentId;
}

export interface AgentSummary {
  id: AgentId;
  name: string;
  tagline: string;
  status: "online" | "offline" | "running" | "degraded";
  lastSessionAgo: string;
  activeSession?: string;
  currentTask?: string;
  workspace?: string;
  uptime?: string;
  cpu?: number;
  mem?: number;
}

export interface Repo {
  id: string;
  name: string;
  owner: string;
  description: string;
  language: string;
  languageColor?: string;
  stars: number;
  forks: number;
  openIssues: number;
  openPRs: number;
  pushedAt: string;
  defaultBranch: string;
  private: boolean;
  /** Number of agents currently attached to this repo. */
  agents?: number;
}

export interface WorkspaceSummary {
  name: string;
  agents: number;
}

// --- Hermes-specific concepts (memory stores, skills, jobs) ---
export interface MemoryStore {
  label: string;
  size: string;
  pct?: number;
}

export interface Skill {
  name: string;
  status: "active" | "idle";
}

export interface Job {
  id?: string;
  name: string;
  status: SessionStatus;
  schedule?: string;
}

// --- Hermes kanban (task pipeline) ---
// Mirrors hermes_cli/kanban_db.py `tasks` table + VALID_STATUSES.
export type TaskStatus =
  | "triage"
  | "todo"
  | "scheduled"
  | "ready"
  | "running"
  | "blocked"
  | "review"
  | "done"
  | "archived";

export interface KanbanTask {
  id: string;
  title: string;
  body?: string;
  status: TaskStatus;
  /** 0 none .. 3 urgent. */
  priority: number;
  /** Worker / swarm agent that claimed it. */
  assignee?: string;
  skills?: string[];
  branchName?: string;
  workspaceKind?: "scratch" | "repo" | string;
  /** Relative label, e.g. "12m ago". */
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  /** Dependency count (task_links). */
  deps?: number;
  consecutiveFailures?: number;
  /** For running cards, e.g. "4m 12s". */
  runtime?: string;
}

// --- Obsidian-specific ---
export interface Note {
  id: string;
  title: string;
  updatedAt: string;
  group?: string;
  /** Markdown body. */
  body: string;
}
