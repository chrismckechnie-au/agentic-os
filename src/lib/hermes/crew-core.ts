import { HERMES_CREW, HERMES_PUBLIC_CHANNELS, type HermesCrewDefinition } from "../config/hermes-crew.ts";
import type {
  HermesCrewActivity,
  HermesCrewChannel,
  HermesCrewDashboard,
  HermesCrewDocument,
  HermesCrewJob,
  HermesCrewProfile,
  HermesCrewRole,
  Job,
  KanbanTask,
  Note,
  SessionStatus,
} from "../types.ts";

export interface CrewProfileSource {
  id: string;
  exists: boolean;
  home?: string;
  model?: string;
  fallbackModel?: string;
  provider?: string;
  lastActivityMs?: number;
}

export interface CrewJobSource {
  id?: string;
  name?: string;
  enabled?: boolean;
  state?: string;
  schedule_display?: string;
  last_status?: string;
  last_error?: string | null;
  last_delivery_error?: string | null;
  next_run_at?: string;
  last_run_at?: string;
  deliver?: string;
  profile?: string;
}

export interface CrewGatewaySource {
  gateway_state?: string;
  active_agents?: number;
  platforms?: Record<string, { state?: string }>;
}

export interface BuildCrewInput {
  hermesHome: string;
  activeProfile?: string;
  profiles: CrewProfileSource[];
  channelNames: Map<string, string>;
  jobs: CrewJobSource[];
  tasks: KanbanTask[];
  notes: Note[];
  loggedEvents?: HermesCrewActivity[];
  ackedEventIds?: Set<string>;
  gateway?: CrewGatewaySource;
  actions?: HermesCrewDashboard["actions"];
  nowMs?: number;
}

function normalizeChannel(value: string): string {
  return value.replace(/^#/, "").trim().toLowerCase();
}

function isDiscordConnected(source?: CrewGatewaySource): "connected" | "disconnected" | "unknown" {
  const state = source?.platforms?.discord?.state;
  if (state === "connected") return "connected";
  if (state === "disconnected" || state === "error" || state === "stopped") return "disconnected";
  return "unknown";
}

function isWebhookConnected(source?: CrewGatewaySource): "connected" | "disconnected" | "unknown" {
  const state = source?.platforms?.webhook?.state;
  if (state === "connected") return "connected";
  if (state === "disconnected" || state === "error" || state === "stopped") return "disconnected";
  return "unknown";
}

function gatewayState(source?: CrewGatewaySource): HermesCrewDashboard["gateway"]["state"] {
  if (source?.gateway_state === "running") return "running";
  if (source?.gateway_state === "stopped" || source?.gateway_state === "exited") return "stopped";
  return "unknown";
}

export function relativeTimeFromMs(value: number | undefined, nowMs = Date.now()): string | undefined {
  if (!value || !Number.isFinite(value)) return undefined;
  const diff = Math.max(0, nowMs - value);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function relativeTimeFromIso(value: string | undefined, nowMs: number): string | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? relativeTimeFromMs(ms, nowMs) : value;
}

export function statusFromCronJob(job: CrewJobSource): SessionStatus {
  const enabled = job.enabled === undefined ? true : Boolean(job.enabled);
  const state = String(job.state ?? "").toLowerCase();
  const last = String(job.last_status ?? "").toLowerCase();
  if (!enabled || state === "paused") return "paused";
  if (state === "running" || last === "running") return "running";
  if (last === "ok" || last === "success" || last === "completed") return "completed";
  if (last === "error" || last === "failed" || last === "failure") return "failed";
  return "queued";
}

export function ownerForJobName(name: string): HermesCrewRole {
  const n = name.toLowerCase();
  if (/\b(social|facebook|instagram|post)\b/.test(n)) return "social";
  if (/\b(alerts?|sentry|incidents?|smoke|health|failure|watchdog)\b/.test(n)) return "incidents";
  if (/\b(deploy|engineering|workflow|governance|kanban)\b/.test(n)) return "engineering";
  if (/\b(research|news|competitor|crawl)\b/.test(n)) return "research";
  return "orchestrator";
}

function channel(name: string, kind: "public" | "private", channelNames: Map<string, string>): HermesCrewChannel {
  const key = normalizeChannel(name);
  return {
    name: key,
    id: channelNames.get(key),
    kind,
    available: channelNames.has(key),
  };
}

function profileSourceFor(def: HermesCrewDefinition, sources: CrewProfileSource[]): CrewProfileSource | undefined {
  return sources.find((source) => source.id === def.id);
}

function taskOwner(task: KanbanTask): string | undefined {
  return task.assignee?.trim().toLowerCase();
}

function activeTask(task: KanbanTask): boolean {
  return task.status !== "done" && task.status !== "archived";
}

function taskNeedsAttention(task: KanbanTask): boolean {
  return task.status === "blocked" || (task.consecutiveFailures ?? 0) > 0;
}

function buildProfile(def: HermesCrewDefinition, input: BuildCrewInput): HermesCrewProfile {
  const source = profileSourceFor(def, input.profiles);
  const available = !!source?.exists;
  const ownedTasks = input.tasks.filter((task) => taskOwner(task) === def.id);
  const openTasks = ownedTasks.filter(activeTask).length;
  const runningTasks = ownedTasks.filter((task) => task.status === "running").length;
  const attentionCount = ownedTasks.filter(taskNeedsAttention).length;
  const privateChannel = channel(def.privateChannel, "private", input.channelNames);
  const publicChannels = def.publicChannels.map((name) => channel(name, "public", input.channelNames));
  const missingChannel = !privateChannel.available;
  const status =
    !available ? "missing"
    : attentionCount > 0 || missingChannel ? "attention"
    : runningTasks > 0 ? "running"
    : openTasks > 0 || def.id === input.activeProfile ? "online"
    : "idle";

  return {
    id: def.id,
    name: def.name,
    role: def.role,
    description: def.description,
    model: source?.model || def.model,
    fallbackModel: source?.fallbackModel || def.fallbackModel,
    reasoning: def.reasoning,
    available,
    status,
    home: source?.home,
    lastActivity: relativeTimeFromMs(source?.lastActivityMs, input.nowMs),
    openTasks,
    runningTasks,
    attentionCount: attentionCount + (missingChannel ? 1 : 0),
    privateChannel,
    publicChannels,
    toolsets: def.toolsets,
  };
}

function mapJob(job: CrewJobSource): HermesCrewJob {
  const name = String(job.name ?? job.id ?? "Untitled job");
  const lastError = job.last_error || job.last_delivery_error || undefined;
  return {
    id: String(job.id ?? name),
    name,
    owner: ownerForJobName(name),
    status: statusFromCronJob(job),
    schedule: job.schedule_display,
    nextRunAt: job.next_run_at,
    lastRunAt: job.last_run_at,
    lastError: lastError ? String(lastError) : undefined,
    deliver: job.deliver,
  };
}

function noteRole(note: Note): HermesCrewRole | undefined {
  const text = `${note.title} ${note.path ?? ""} ${(note.tags ?? []).join(" ")} ${note.body.slice(0, 600)}`.toLowerCase();
  const hit = HERMES_CREW.find((def) => def.documentHints.some((hint) => text.includes(hint)));
  return hit?.role;
}

function mapDocuments(notes: Note[]): HermesCrewDocument[] {
  return notes
    .map((note): HermesCrewDocument | null => {
      const role = noteRole(note);
      if (!role) return null;
      return {
        id: note.id,
        title: note.title,
        path: note.path ?? note.id,
        role,
        profile: HERMES_CREW.find((def) => def.role === role)?.id,
        kind: "obsidian",
        updatedAt: note.updatedAt,
      };
    })
    .filter((entry): entry is HermesCrewDocument => Boolean(entry))
    .slice(0, 12);
}

function jobActivity(job: HermesCrewJob, nowMs: number): HermesCrewActivity | null {
  if (job.status !== "failed" && job.status !== "running") return null;
  const id = `cron:${job.id}:${job.status}`;
  return {
    id,
    source: "cron",
    sourceId: job.id,
    role: job.owner,
    title: job.status === "failed" ? `${job.name} failed` : `${job.name} running`,
    status: job.status,
    summary: job.lastError,
    when: relativeTimeFromIso(job.lastRunAt, nowMs) ?? "—",
    ts: job.lastRunAt,
  };
}

function taskActivity(task: KanbanTask): HermesCrewActivity | null {
  if (!["running", "blocked", "review"].includes(task.status)) return null;
  const def = HERMES_CREW.find((entry) => entry.id === taskOwner(task));
  return {
    id: `kanban:${task.id}:${task.status}`,
    source: "kanban",
    sourceId: task.id,
    profile: task.assignee,
    role: def?.role,
    title: task.title,
    status: task.status,
    summary: task.body,
    when: task.startedAt ?? task.createdAt,
    ts: undefined,
  };
}

function sortedActivities(
  jobs: HermesCrewJob[],
  tasks: KanbanTask[],
  loggedEvents: HermesCrewActivity[],
  acked: Set<string>,
  nowMs: number,
): HermesCrewActivity[] {
  const generated = [
    ...jobs.map((job) => jobActivity(job, nowMs)),
    ...tasks.map(taskActivity),
  ].filter((entry): entry is HermesCrewActivity => Boolean(entry));

  return [...loggedEvents, ...generated]
    .map((entry) => ({ ...entry, acked: acked.has(entry.id) || entry.acked }))
    .slice(0, 20);
}

export function buildHermesCrewDashboard(input: BuildCrewInput): HermesCrewDashboard {
  const nowMs = input.nowMs ?? Date.now();
  const jobs = input.jobs.map(mapJob);
  const crew = HERMES_CREW.map((def) => buildProfile(def, { ...input, nowMs }));
  const channels = [
    ...HERMES_PUBLIC_CHANNELS.map((name) => channel(name, "public", input.channelNames)),
    ...HERMES_CREW.map((def) => channel(def.privateChannel, "private", input.channelNames)),
  ];
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const missingProfiles = crew.filter((profile) => !profile.available);
  const missingPrivateChannels = crew.filter((profile) => !profile.privateChannel.available);
  const openTasks = input.tasks.filter(activeTask).length;
  const runningTasks = input.tasks.filter((task) => task.status === "running").length;
  const attention = [
    ...missingProfiles.map((profile) => `${profile.id} profile is not created yet`),
    ...missingPrivateChannels.map((profile) => `#${profile.privateChannel.name} private channel is not in the channel directory`),
    ...failedJobs.map((job) => `${job.name}: ${job.lastError ?? "last run failed"}`),
  ];

  return {
    hermesHome: input.hermesHome,
    activeProfile: input.activeProfile,
    gateway: {
      state: gatewayState(input.gateway),
      discord: isDiscordConnected(input.gateway),
      webhook: isWebhookConnected(input.gateway),
      activeAgents: Number(input.gateway?.active_agents ?? 0),
    },
    crew,
    channels,
    jobs,
    activity: sortedActivities(jobs, input.tasks, input.loggedEvents ?? [], input.ackedEventIds ?? new Set(), nowMs),
    documents: mapDocuments(input.notes),
    attention,
    stats: {
      profiles: crew.length,
      availableProfiles: crew.filter((profile) => profile.available).length,
      openTasks,
      runningTasks,
      failedJobs: failedJobs.length,
      missingPrivateChannels: missingPrivateChannels.length,
    },
    actions: input.actions ?? {
      kanbanWritesEnabled: false,
      crewActionsEnabled: false,
      cronActionsEnabled: false,
    },
  };
}

export function mockHermesCrewDashboard(tasks: KanbanTask[], jobs: Job[]): HermesCrewDashboard {
  const channelNames = new Map<string, string>();
  for (const name of HERMES_PUBLIC_CHANNELS) channelNames.set(name, `mock-${name}`);
  for (const def of HERMES_CREW) channelNames.set(def.privateChannel, `mock-${def.privateChannel}`);

  return buildHermesCrewDashboard({
    hermesHome: "~/.hermes",
    activeProfile: "refuelrops",
    profiles: HERMES_CREW.map((def) => ({
      id: def.id,
      exists: true,
      home: `~/.hermes/profiles/${def.id}`,
      model: def.model,
      fallbackModel: def.fallbackModel,
      lastActivityMs: Date.now() - 30 * 60_000,
    })),
    channelNames,
    jobs: jobs.map((job) => ({
      id: job.id ?? job.name,
      name: job.name,
      enabled: job.status !== "paused",
      schedule_display: job.schedule,
      last_status: job.status === "failed" ? "error" : job.status === "completed" ? "ok" : job.status,
    })),
    tasks,
    notes: [],
    gateway: {
      gateway_state: "running",
      active_agents: 0,
      platforms: { discord: { state: "connected" }, webhook: { state: "connected" } },
    },
    actions: {
      kanbanWritesEnabled: false,
      crewActionsEnabled: false,
      cronActionsEnabled: false,
    },
  });
}
