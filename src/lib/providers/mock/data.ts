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

// ---------------------------------------------------------------------------
// Mock fixtures. Modelled on the Agentic OS mockups so the prototype looks
// real. Swapped out wholesale when live providers are implemented.
// ---------------------------------------------------------------------------

export const OVERVIEW_STATS: StatMetric[] = [
  { id: "running-agents", label: "Running Agents", value: "4 / 4", hint: "All agents online", icon: "Activity", spark: [2, 3, 3, 4, 3, 4, 4] },
  { id: "active-sessions", label: "Active Sessions", value: "12", delta: "+2 from last hour", trend: "up", icon: "MessageSquare", spark: [6, 7, 9, 8, 10, 11, 12] },
  { id: "tasks-completed", label: "Tasks Completed", value: "248", delta: "+18 from last 24h", trend: "up", icon: "CircleCheck", spark: [180, 195, 205, 220, 230, 240, 248] },
  { id: "success-rate", label: "Success Rate", value: "96.3%", delta: "+1.2% from last 24h", trend: "up", icon: "Target", spark: [93, 94, 94, 95, 95, 96, 96.3] },
  { id: "active-workspaces", label: "Active Workspaces", value: "8", delta: "+1 from last 24h", trend: "up", icon: "FolderGit2", spark: [5, 6, 6, 7, 7, 8, 8] },
];

export const AGENTS_SUMMARY: AgentSummary[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    tagline: "AI assistant for coding, debugging and refactoring.",
    status: "running",
    lastSessionAgo: "2m ago",
    activeSession: "refuelr-chapter-12",
    currentTask: "Refactoring authentication middleware and improving session handling",
    workspace: "frontend-platform",
  },
  {
    id: "codex",
    name: "Codex",
    tagline: "OpenAI coding agent for autonomous development.",
    status: "running",
    lastSessionAgo: "5m ago",
    activeSession: "feature-auth-flow",
    currentTask: "Implementing rate limiting and updating API endpoints",
    workspace: "api-services",
  },
  {
    id: "hermes",
    name: "Hermes",
    tagline: "Autonomous AI agent for research and automation.",
    status: "online",
    lastSessionAgo: "8m ago",
    activeSession: "hermes-researcher",
    currentTask: "Optimize database query performance",
    workspace: "api-services",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    tagline: "Knowledge management and note-taking.",
    status: "online",
    lastSessionAgo: "10m ago",
    activeSession: "refuelr-kb-update",
    currentTask: "Updated 12 notes in knowledge base",
    workspace: "research-assistant",
  },
];

export const WORKSPACES: WorkspaceSummary[] = [
  { name: "frontend-platform", agents: 3 },
  { name: "api-services", agents: 2 },
  { name: "research-assistant", agents: 2 },
  { name: "marketing-site", agents: 1 },
  { name: "data-pipeline", agents: 1 },
  { name: "devops-infra", agents: 1 },
  { name: "refuelr", agents: 2 },
  { name: "operations", agents: 1 },
];

export const HEALTH: HealthItem[] = [
  { label: "API", status: "healthy" },
  { label: "Database", status: "healthy" },
  { label: "Agents", status: "healthy" },
  { label: "Integrations", status: "healthy" },
  { label: "Storage", status: "healthy" },
  { label: "MCP Servers", status: "healthy", detail: "8 / 8" },
  { label: "Background Jobs", status: "running", detail: "3 running" },
];

export const ACTIVITY: ActivityItem[] = [
  { id: "a1", icon: "CircleCheck", text: 'Codex completed task "Optimize database query performance"', when: "18m ago", agentId: "codex" },
  { id: "a2", icon: "FileText", text: "Hermes uploaded file architecture-overview.pdf", when: "32m ago", agentId: "hermes" },
  { id: "a3", icon: "Sparkles", text: "Claude Code pushed changes to frontend-platform", when: "1h ago", agentId: "claude-code" },
  { id: "a4", icon: "Github", text: "GitHub integration synced 3 repositories", when: "2h ago" },
  { id: "a5", icon: "FolderPlus", text: "New workspace marketing-site created", when: "3h ago" },
  { id: "a6", icon: "Hexagon", text: "Obsidian updated 12 notes in knowledge base", when: "3h ago", agentId: "obsidian" },
];

// --- Sessions per agent -----------------------------------------------------

export const SESSIONS: Record<AgentId, Session[]> = {
  "claude-code": [
    { id: "refuelr-chapter-12", agentId: "claude-code", title: "Optimize database query performance", workspace: "api-services", status: "active", updatedAt: "2m ago", group: "Today" },
    { id: "social-login", agentId: "claude-code", title: "Add social login to authentication flow", workspace: "frontend-platform", status: "in_progress", updatedAt: "5m ago", group: "Today" },
    { id: "rag-vectors", agentId: "claude-code", title: "Research vector databases for RAG", workspace: "research-assistant", status: "paused", updatedAt: "32m ago", group: "Today" },
    { id: "session-timeout", agentId: "claude-code", title: "Fix session timeout bug", workspace: "frontend-platform", status: "completed", updatedAt: "1h ago", group: "Today" },
    { id: "audit-logging", agentId: "claude-code", title: "Add audit logging to API", workspace: "api-services", status: "in_progress", updatedAt: "1h ago", group: "Today" },
    { id: "service-perms", agentId: "claude-code", title: "Refactor user service permissions", workspace: "api-services", status: "completed", updatedAt: "2h ago", group: "Yesterday" },
    { id: "dep-security", agentId: "claude-code", title: "Update dependencies & security fixes", workspace: "frontend-platform", status: "completed", updatedAt: "3h ago", group: "Yesterday" },
    { id: "feature-flag", agentId: "claude-code", title: "Implement feature flag rollout", workspace: "marketing-site", status: "paused", updatedAt: "Yesterday", group: "Previous 7 days" },
  ],
  codex: [
    { id: "feature-auth-flow", agentId: "codex", title: "Add social login to authentication flow", workspace: "frontend-platform", status: "in_progress", updatedAt: "5m ago", group: "Today" },
    { id: "optimize-db", agentId: "codex", title: "Optimize database query performance", workspace: "api-services", status: "completed", updatedAt: "18m ago", group: "Today" },
    { id: "fix-payment", agentId: "codex", title: "Fix session timeout bug", workspace: "frontend-platform", status: "completed", updatedAt: "1h ago", group: "Today" },
    { id: "audit-api", agentId: "codex", title: "Add audit logging to API", workspace: "api-services", status: "completed", updatedAt: "1h ago", group: "Today" },
    { id: "user-scal", agentId: "codex", title: "Refactor user service for scalability", workspace: "api-services", status: "completed", updatedAt: "2h ago", group: "Yesterday" },
    { id: "rate-limit", agentId: "codex", title: "Implement rate limiting middleware", workspace: "api-services", status: "reviewing", updatedAt: "3h ago", group: "Yesterday" },
    { id: "ci-monorepo", agentId: "codex", title: "Update CI pipeline for monorepo", workspace: "devops-infra", status: "completed", updatedAt: "6h ago", group: "Previous 7 days" },
    { id: "bump-deps", agentId: "codex", title: "Bump dependencies and fix vulns", workspace: "frontend-platform", status: "completed", updatedAt: "Yesterday", group: "Previous 7 days" },
  ],
  hermes: [
    { id: "hermes-researcher", agentId: "hermes", title: "Optimize database query performance", workspace: "api-services", status: "running", updatedAt: "18m ago", group: "Today" },
    { id: "rag-vectordb", agentId: "hermes", title: "Research vector databases for RAG", workspace: "research-assistant", status: "reviewing", updatedAt: "32m ago", group: "Today" },
    { id: "q2-marketing", agentId: "hermes", title: "Analyze Q2 marketing campaign data", workspace: "marketing-site", status: "completed", updatedAt: "1h ago", group: "Today" },
    { id: "incident-triage", agentId: "hermes", title: "Incident triage: elevated error rates", workspace: "api-services", status: "completed", updatedAt: "2h ago", group: "Today" },
    { id: "onboarding-v2", agentId: "hermes", title: "Build out onboarding flow v2", workspace: "frontend-platform", status: "completed", updatedAt: "3h ago", group: "Yesterday" },
    { id: "docs-audit", agentId: "hermes", title: "Content audit for docs overhaul", workspace: "data-pipeline", status: "reviewing", updatedAt: "5h ago", group: "Yesterday" },
    { id: "sla-breach", agentId: "hermes", title: "SLA breach investigation", workspace: "backend-services", status: "completed", updatedAt: "Yesterday", group: "Previous 7 days" },
    { id: "weekly-ops", agentId: "hermes", title: "Weekly ops summary & report", workspace: "operations", status: "completed", updatedAt: "Yesterday", group: "Previous 7 days" },
  ],
  obsidian: [
    { id: "refuelr-kb-update", agentId: "obsidian", title: "Refuelr knowledge base update", workspace: "research-assistant", status: "active", updatedAt: "10m ago", group: "Today" },
    { id: "meeting-notes", agentId: "obsidian", title: "Meeting notes — product sync", workspace: "operations", status: "completed", updatedAt: "1h ago", group: "Today" },
    { id: "project-planning", agentId: "obsidian", title: "Project planning Q3", workspace: "operations", status: "in_progress", updatedAt: "3h ago", group: "Today" },
    { id: "research-notes", agentId: "obsidian", title: "Research notes — RAG architectures", workspace: "research-assistant", status: "completed", updatedAt: "1d ago", group: "Yesterday" },
    { id: "ideas-brainstorm", agentId: "obsidian", title: "Ideas brainstorm", workspace: "marketing-site", status: "completed", updatedAt: "1d ago", group: "Yesterday" },
    { id: "archive-cleanup", agentId: "obsidian", title: "Archive cleanup", workspace: "research-assistant", status: "completed", updatedAt: "2d ago", group: "Previous 7 days" },
    { id: "knowledge-base", agentId: "obsidian", title: "Knowledge base reorg", workspace: "research-assistant", status: "completed", updatedAt: "3d ago", group: "Previous 7 days" },
    { id: "documentation", agentId: "obsidian", title: "Documentation pass", workspace: "data-pipeline", status: "completed", updatedAt: "4d ago", group: "Previous 7 days" },
  ],
};

// --- Active session detail per agent ---------------------------------------

export const ACTIVE_SESSIONS: Record<AgentId, SessionDetail> = {
  "claude-code": {
    id: "refuelr-chapter-12",
    agentId: "claude-code",
    title: "Optimize database query performance",
    workspace: "api-services",
    status: "active",
    updatedAt: "2m ago",
    branch: "feat/query-optimizations",
    model: "Claude Opus 4.8",
    startedAt: "Today, 10:24 AM (18m ago)",
    tokensIn: 128600,
    tokensOut: 45200,
    totalTokens: 173800,
    contextPct: 17,
    transcript: [
      { role: "user", kind: "prompt", text: "Optimize the slow orders query in src/services/orders.ts\nThe query is taking ~2.4s on large datasets." },
      { role: "agent", kind: "info", text: "Analyzing orders query performance..." },
      { role: "agent", kind: "success", text: "Found N+1 query pattern in line 128" },
      { role: "agent", kind: "success", text: "Added composite index on (user_id, created_at)" },
      { role: "agent", kind: "success", text: "Rewrote query using window function for pagination" },
      { role: "agent", kind: "success", text: "Added query hints for Postgres optimizer" },
      { role: "agent", kind: "info", text: "Running tests..." },
      { role: "agent", kind: "success", text: "All tests passed (42/42)" },
      { role: "agent", kind: "success", text: "Query time improved: 2.4s -> 180ms (93% faster)" },
    ],
    filesTouched: [
      { name: "orders.ts", kind: "TS", change: "M" },
      { name: "schema.sql", kind: "SQL", change: "M" },
      { name: "orders.test.ts", kind: "TS", change: "M" },
      { name: "config.json", kind: "JSON", change: "M" },
    ],
    commits: [
      { sha: "9f3b2a1", message: "Optimize orders query performance", when: "18m ago" },
      { sha: "c1a7d4e", message: "Add composite index for user orders", when: "27m ago" },
      { sha: "e7d9b20", message: "Refactor pagination logic", when: "43m ago" },
    ],
  },
  codex: {
    id: "feature-auth-flow",
    agentId: "codex",
    title: "Add social login to authentication flow",
    workspace: "frontend-platform",
    status: "in_progress",
    updatedAt: "5m ago",
    branch: "feat/social-login",
    model: "codex-1.5",
    startedAt: "5 minutes ago",
    estimate: "~3 minutes remaining",
    sandbox: "Ubuntu 22.04",
    permissions: "Read/Write",
    transcript: [
      { role: "agent", kind: "output", text: "codex$ npm run dev" },
      { role: "agent", kind: "output", text: "> next dev -p 3000" },
      { role: "agent", kind: "success", text: "Ready in 1.2s" },
      { role: "agent", kind: "output", text: "Compiled /api/auth/[...nextauth] in 1.8s (742 modules)" },
      { role: "agent", kind: "output", text: "GET /api/providers 200 in 162ms" },
      { role: "agent", kind: "output", text: "POST /api/auth/callback/google 200 in 831ms" },
      { role: "agent", kind: "success", text: "All tests passed (42/42)" },
      { role: "agent", kind: "success", text: "Lint passed" },
      { role: "agent", kind: "success", text: "Type check passed" },
    ],
    plan: [
      { label: "Audit current auth flow and provider setup", done: true },
      { label: "Add Google and GitHub OAuth providers", done: true },
      { label: "Create SocialButtons component", done: true },
      { label: "Wire up sign-in UI and callbacks", done: false, current: true },
      { label: "Add tests and update docs", done: false },
    ],
    filesTouched: [
      { name: "package.json", kind: "JSON", change: "M" },
      { name: "route.ts", kind: "TS", change: "M" },
      { name: "SocialButtons.tsx", kind: "TSX", change: "A" },
      { name: "providers.ts", kind: "TS", change: "A" },
      { name: "auth.ts", kind: "TS", change: "M" },
    ],
  },
  hermes: {
    id: "hermes-researcher",
    agentId: "hermes",
    title: "Optimize database query performance",
    workspace: "api-services",
    status: "running",
    updatedAt: "18m ago",
    model: "claude-opus-4-8",
    startedAt: "18m ago",
    transcript: [
      { role: "agent", kind: "info", text: "Hermes v1.8.2 initialized" },
      { role: "agent", kind: "info", text: "Workspace: api-services" },
      { role: "agent", kind: "info", text: "Profile: research" },
      { role: "agent", kind: "info", text: "Memory context loaded (2.43 GB)" },
      { role: "agent", kind: "skill", text: "sql-analyzer    Loaded" },
      { role: "agent", kind: "skill", text: "query-optimizer Loaded" },
      { role: "agent", kind: "skill", text: "perf-profiler   Loaded" },
      { role: "agent", kind: "job", text: "Starting job: optimize-database-queries" },
      { role: "agent", kind: "step", text: "1/6 Collect slow query logs" },
      { role: "agent", kind: "output", text: "Found 127 slow queries (>500ms)" },
      { role: "agent", kind: "step", text: "2/6 Analyze query patterns" },
      { role: "agent", kind: "output", text: "Identified 23 unique query patterns" },
      { role: "agent", kind: "step", text: "3/6 Generate optimization recommendations" },
      { role: "agent", kind: "output", text: "Generated 41 recommendations" },
      { role: "agent", kind: "step", text: "4/6 Validate indexes" },
      { role: "agent", kind: "output", text: "7 missing indexes identified" },
      { role: "agent", kind: "step", text: "5/6 Benchmark improvements" },
      { role: "agent", kind: "output", text: "Avg latency improvement: 42.7%" },
      { role: "agent", kind: "step", text: "6/6 Compile report and artifacts" },
      { role: "agent", kind: "info", text: "Writing artifacts to /artifacts/optimize-queries/" },
      { role: "agent", kind: "info", text: "Job in progress..." },
    ],
  },
  obsidian: {
    id: "refuelr-kb-update",
    agentId: "obsidian",
    title: "Refuelr knowledge base update",
    workspace: "research-assistant",
    status: "active",
    updatedAt: "10m ago",
    model: "claude-haiku-4-5",
    startedAt: "10m ago",
    transcript: [
      { role: "agent", kind: "info", text: "Connected to Obsidian Vault: Refuelr" },
      { role: "agent", kind: "info", text: "Indexing 1,284 notes..." },
      { role: "agent", kind: "success", text: "Index complete" },
      { role: "agent", kind: "step", text: "Updating note: Project Overview" },
      { role: "agent", kind: "step", text: "Linking 8 related notes" },
      { role: "agent", kind: "success", text: "12 notes updated, 31 backlinks created" },
    ],
  },
};

// --- Per-agent stat cards ---------------------------------------------------

export const AGENT_STATS: Record<AgentId, StatMetric[]> = {
  "claude-code": [
    { id: "cc-active", label: "Active Sessions", value: "3", delta: "+1 from last hour", trend: "up", icon: "Activity", spark: [1, 2, 2, 3, 2, 3, 3] },
    { id: "cc-tasks", label: "Tasks Today", value: "12", delta: "+4 from yesterday", trend: "up", icon: "ListChecks", spark: [4, 6, 7, 8, 10, 11, 12] },
    { id: "cc-files", label: "Files Changed", value: "248", delta: "+86 from yesterday", trend: "up", icon: "FileText", spark: [120, 150, 170, 190, 210, 230, 248] },
    { id: "cc-mcp", label: "MCP Connections", value: "8", hint: "All systems operational", icon: "Plug", spark: [8, 8, 7, 8, 8, 8, 8] },
  ],
  codex: [
    { id: "cx-running", label: "Running Tasks", value: "3", hint: "2 in progress", icon: "CodeXml", spark: [1, 2, 3, 2, 3, 3, 3] },
    { id: "cx-active", label: "Active Sessions", value: "12", delta: "+2 from last hour", trend: "up", icon: "LayoutGrid", spark: [7, 8, 9, 10, 11, 11, 12] },
    { id: "cx-prs", label: "Pull Requests", value: "7", delta: "+3 from last 24h", trend: "up", icon: "GitPullRequest", spark: [3, 4, 4, 5, 6, 7, 7] },
    { id: "cx-tests", label: "Test Pass Rate", value: "96.8%", delta: "+1.6% from last 24h", trend: "up", icon: "CircleCheck", spark: [94, 95, 95, 96, 96, 96.5, 96.8] },
  ],
  hermes: [
    { id: "hm-jobs", label: "Active Jobs", value: "7", hint: "4 running · 3 queued", icon: "Activity", spark: [3, 4, 5, 6, 6, 7, 7] },
    { id: "hm-memory", label: "Memory Size", value: "2.43 GB", delta: "+128 MB from last 24h", trend: "up", icon: "Database", spark: [2.0, 2.1, 2.2, 2.3, 2.35, 2.4, 2.43] },
    { id: "hm-skills", label: "Skills Active", value: "18", delta: "+2 from last 24h", trend: "up", icon: "Sparkles", spark: [14, 15, 16, 16, 17, 18, 18] },
    { id: "hm-success", label: "Success Rate", value: "96.8%", delta: "+1.4% from last 24h", trend: "up", icon: "Target", spark: [94, 95, 95, 96, 96, 96.5, 96.8] },
  ],
  obsidian: [
    { id: "ob-notes", label: "Notes", value: "1,284", delta: "+12 today", trend: "up", icon: "FileText", spark: [1240, 1255, 1262, 1270, 1276, 1280, 1284] },
    { id: "ob-links", label: "Backlinks", value: "9,612", delta: "+31 today", trend: "up", icon: "Link2", spark: [9400, 9480, 9520, 9560, 9580, 9600, 9612] },
    { id: "ob-tags", label: "Tags", value: "214", hint: "Across 9 vaults", icon: "Hash", spark: [200, 204, 206, 208, 210, 212, 214] },
    { id: "ob-synced", label: "Sync Status", value: "Synced", hint: "Last sync 2m ago", icon: "RefreshCw", spark: [1, 1, 1, 1, 1, 1, 1] },
  ],
};

// --- Hermes memory / skills / jobs ------------------------------------------

export const HERMES_MEMORY: MemoryStore[] = [
  { label: "long-term", size: "1.12 GB", pct: 46 },
  { label: "working", size: "892 MB", pct: 36 },
  { label: "session", size: "432 MB", pct: 18 },
];

export const HERMES_SKILLS: Skill[] = [
  { name: "sql-analyzer", status: "active" },
  { name: "query-optimizer", status: "active" },
  { name: "perf-profiler", status: "active" },
  { name: "web-researcher", status: "idle" },
  { name: "report-writer", status: "idle" },
];

export const HERMES_JOBS: Job[] = [
  { name: "optimize-database-queries", status: "running" },
  { name: "nightly-backup", status: "queued", schedule: "0 2 * * *" },
  { name: "weekly-audit", status: "queued", schedule: "0 9 * * 1" },
  { name: "daily-report", status: "completed", schedule: "0 18 * * *" },
];

// --- Obsidian notes ---------------------------------------------------------

export const OBSIDIAN_NOTES: Note[] = [
  {
    id: "project-overview",
    title: "Project Overview",
    updatedAt: "10m ago",
    group: "Today",
    body: `# Project Overview

## Refuelr Platform

Refuelr is an AI-powered platform that helps users build and scale their projects with intelligent automation.

### Key Features

- AI Agents (Claude, Codex, Hermes)
- Knowledge Management
- Automated Workflows
- Real-time Collaboration

### Current Status

- [x] Authentication System
- [x] User Dashboard
- [ ] Payment Integration
- [ ] AI Agent Orchestration`,
  },
  {
    id: "meeting-notes",
    title: "Meeting notes — product sync",
    updatedAt: "1h ago",
    group: "Today",
    body: `# Product Sync

- Reviewed Q3 roadmap
- Agreed to ship social login next sprint
- Open question: rate limiting strategy`,
  },
  {
    id: "research-notes",
    title: "Research notes — RAG architectures",
    updatedAt: "1d ago",
    group: "Yesterday",
    body: `# RAG architectures

Comparing vector databases for retrieval-augmented generation.

- pgvector — simple, lives in Postgres
- Qdrant — fast, great filtering
- Weaviate — hybrid search`,
  },
];

// --- Repos (GitHub-shaped) --------------------------------------------------

export const REPOS: Repo[] = [
  { id: "refuelr", name: "refuelr", owner: "chrismckechnie", description: "AI-powered platform for building and scaling projects with intelligent automation.", language: "TypeScript", languageColor: "#3178c6", stars: 142, forks: 18, openIssues: 12, openPRs: 4, pushedAt: "18m ago", defaultBranch: "main", private: true, agents: 3 },
  { id: "frontend-platform", name: "frontend-platform", owner: "chrismckechnie", description: "Next.js front-end for the Refuelr platform with App Router and Tailwind.", language: "TypeScript", languageColor: "#3178c6", stars: 64, forks: 7, openIssues: 9, openPRs: 2, pushedAt: "1h ago", defaultBranch: "main", private: true, agents: 2 },
  { id: "api-services", name: "api-services", owner: "chrismckechnie", description: "Backend API services, auth, billing and rate limiting.", language: "Go", languageColor: "#00add8", stars: 38, forks: 4, openIssues: 6, openPRs: 3, pushedAt: "18m ago", defaultBranch: "main", private: true, agents: 2 },
  { id: "hermes-agent", name: "hermes-agent", owner: "nousresearch", description: "Self-improving AI agent that learns from experience and maintains persistent memory.", language: "Python", languageColor: "#3572a5", stars: 2841, forks: 312, openIssues: 47, openPRs: 11, pushedAt: "3h ago", defaultBranch: "main", private: false, agents: 1 },
  { id: "data-pipeline", name: "data-pipeline", owner: "chrismckechnie", description: "ETL and analytics pipelines for product metrics.", language: "Python", languageColor: "#3572a5", stars: 21, forks: 2, openIssues: 4, openPRs: 1, pushedAt: "5h ago", defaultBranch: "main", private: true, agents: 1 },
  { id: "marketing-site", name: "marketing-site", owner: "chrismckechnie", description: "Public marketing website and blog.", language: "Astro", languageColor: "#ff5d01", stars: 12, forks: 1, openIssues: 2, openPRs: 0, pushedAt: "1d ago", defaultBranch: "main", private: false, agents: 1 },
  { id: "devops-infra", name: "devops-infra", owner: "chrismckechnie", description: "Terraform, CI pipelines and deployment manifests.", language: "HCL", languageColor: "#844fba", stars: 8, forks: 0, openIssues: 3, openPRs: 1, pushedAt: "6h ago", defaultBranch: "main", private: true, agents: 1 },
  { id: "obsidian-vault-sync", name: "obsidian-vault-sync", owner: "chrismckechnie", description: "Sync utilities and plugins for the Refuelr Obsidian knowledge base.", language: "TypeScript", languageColor: "#3178c6", stars: 5, forks: 0, openIssues: 1, openPRs: 0, pushedAt: "2d ago", defaultBranch: "main", private: true, agents: 1 },
];

// --- Hermes kanban tasks (modelled on hermes_cli kanban `tasks` table) ------

export const HERMES_TASKS: KanbanTask[] = [
  // triage — just decomposed, not yet specified
  { id: "T-142", title: "Investigate intermittent 502s on /checkout", body: "Decompose from incident goal; reproduce and isolate failing dependency.", status: "triage", priority: 3, createdAt: "4m ago", deps: 0 },
  { id: "T-141", title: "Summarize competitor pricing changes", body: "From weekly research routine. Needs scope + sources.", status: "triage", priority: 1, createdAt: "22m ago", skills: ["web-researcher"] },

  // todo — specified, queued for scheduling
  { id: "T-138", title: "Add composite index to events table", body: "perf-profiler flagged seq scans on (tenant, created_at).", status: "todo", priority: 2, createdAt: "1h ago", skills: ["sql-analyzer"], workspaceKind: "repo", deps: 1 },
  { id: "T-137", title: "Draft Q2 marketing recap", status: "todo", priority: 1, createdAt: "1h ago", skills: ["report-writer"] },
  { id: "T-135", title: "Backfill embeddings for archived notes", body: "1,284 notes; batch in chunks of 200.", status: "todo", priority: 0, createdAt: "2h ago", deps: 2 },

  // scheduled — cron / future window
  { id: "T-131", title: "Nightly database backup verification", status: "scheduled", priority: 2, createdAt: "3h ago", branchName: "ops/backup-verify", skills: ["sql-analyzer"] },
  { id: "T-129", title: "Weekly dependency audit", status: "scheduled", priority: 1, createdAt: "5h ago" },

  // ready — claimable by a swarm worker
  { id: "T-126", title: "Optimize orders pagination query", body: "Rewrite with window function; target <200ms p95.", status: "ready", priority: 3, createdAt: "26m ago", skills: ["query-optimizer", "perf-profiler"], branchName: "feat/orders-pagination", workspaceKind: "repo", deps: 1 },
  { id: "T-124", title: "Generate API docs from OpenAPI spec", status: "ready", priority: 1, createdAt: "40m ago", skills: ["report-writer"], workspaceKind: "scratch" },

  // running — claimed, in progress
  { id: "T-120", title: "Optimize database query performance", body: "6-step job: collect logs → analyze → recommend → validate → benchmark → report.", status: "running", priority: 3, assignee: "worker-1", runtime: "4m 12s", createdAt: "18m ago", startedAt: "12m ago", skills: ["sql-analyzer", "query-optimizer"], branchName: "feat/query-optimizations", workspaceKind: "repo" },
  { id: "T-118", title: "Crawl + classify competitor changelogs", status: "running", priority: 2, assignee: "worker-2", runtime: "9m 03s", createdAt: "30m ago", startedAt: "9m ago", skills: ["web-researcher"] },
  { id: "T-117", title: "Build onboarding flow v2 spec", status: "running", priority: 1, assignee: "swarm-a", runtime: "1m 41s", createdAt: "35m ago", startedAt: "2m ago" },

  // blocked — waiting on a dependency or failing
  { id: "T-114", title: "Migrate auth tokens to new schema", body: "Blocked on T-138 (index) and a migration approval.", status: "blocked", priority: 3, createdAt: "2h ago", deps: 2, skills: ["sql-analyzer"], branchName: "chore/token-migration" },
  { id: "T-112", title: "Sync Slack notifications integration", body: "Gateway credentials missing.", status: "blocked", priority: 1, createdAt: "3h ago", consecutiveFailures: 2, assignee: "worker-3" },

  // review — completed work awaiting check
  { id: "T-108", title: "Rate limiting middleware", body: "Implemented token bucket; needs review before merge.", status: "review", priority: 2, createdAt: "3h ago", completedAt: "20m ago", skills: ["query-optimizer"], branchName: "feat/rate-limit", workspaceKind: "repo", deps: 1 },
  { id: "T-106", title: "Docs content audit", status: "review", priority: 0, createdAt: "5h ago", completedAt: "1h ago", skills: ["report-writer"] },

  // done
  { id: "T-101", title: "Daily ops summary report", status: "done", priority: 1, createdAt: "Yesterday", completedAt: "6h ago", skills: ["report-writer"] },
  { id: "T-099", title: "SLA breach postmortem", status: "done", priority: 2, createdAt: "Yesterday", completedAt: "Yesterday", skills: ["web-researcher", "report-writer"] },
  { id: "T-097", title: "Add missing indexes (7)", status: "done", priority: 3, createdAt: "2d ago", completedAt: "1d ago", skills: ["sql-analyzer"], branchName: "perf/indexes", workspaceKind: "repo" },

  // archived — excluded from the board by default
  { id: "T-080", title: "One-off data export for finance", status: "archived", priority: 0, createdAt: "1w ago", completedAt: "6d ago" },
];
