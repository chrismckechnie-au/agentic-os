import { HERMES_CREW, HERMES_PUBLIC_CHANNELS, type HermesCrewDefinition } from "../config/hermes-crew.ts";
import type {
  HermesCrewActionRecord,
  HermesCrewActivity,
  HermesCrewDashboard,
  HermesCrewDocument,
  HermesCrewIssue,
  HermesCrewIssueSeverity,
  HermesCrewJob,
  HermesCrewProfile,
  HermesCrewRole,
  HermesCrewScorecard,
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
  actionHistory?: HermesCrewActionRecord[];
  gateway?: CrewGatewaySource;
  actions?: HermesCrewDashboard["actions"];
  nowMs?: number;
}

function normalizeChannel(value: string): string {
  return value.replace(/^#/, "").trim().toLowerCase();
}

function normalizeProfileId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const lowered = value.trim().toLowerCase();
  const direct = HERMES_CREW.find((def) => def.id === lowered);
  if (direct) return direct.id;
  const collapsed = lowered.replace(/[^a-z0-9]/g, "");
  return HERMES_CREW.find((def) => def.id.replace(/[^a-z0-9]/g, "") == collapsed)?.id;
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

function channel(name: string, kind: "public" | "private", channelNames: Map<string, string>) {
  const key = normalizeChannel(name);
  return {
    name: key,
    id: channelNames.get(key),
    kind,
    available: channelNames.has(key),
  } as const;
}

function profileSourceFor(def: HermesCrewDefinition, sources: CrewProfileSource[]): CrewProfileSource | undefined {
  return sources.find((source) => source.id === def.id);
}

function taskOwner(task: KanbanTask): string | undefined {
  return normalizeProfileId(task.assignee);
}

function activeTask(task: KanbanTask): boolean {
  return task.status !== "done" && task.status !== "archived";
}

function taskNeedsAttention(task: KanbanTask): boolean {
  return task.status === "blocked" || (task.consecutiveFailures ?? 0) > 0;
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
    profile: HERMES_CREW.find((def) => def.role === job.owner)?.id,
    title: job.status === "failed" ? `${job.name} failed` : `${job.name} running`,
    status: job.status,
    summary: job.lastError,
    when: relativeTimeFromIso(job.lastRunAt, nowMs) ?? "—",
    ts: job.lastRunAt,
  };
}

function taskActivity(task: KanbanTask): HermesCrewActivity | null {
  if (!["running", "blocked", "review"].includes(task.status)) return null;
  const profile = taskOwner(task);
  const def = HERMES_CREW.find((entry) => entry.id === profile);
  return {
    id: `kanban:${task.id}:${task.status}`,
    source: "kanban",
    sourceId: task.id,
    profile,
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

const severityWeights: Record<HermesCrewIssueSeverity, number> = {
  critical: 400,
  high: 300,
  medium: 200,
  low: 100,
};

function scoreIssue(severity: HermesCrewIssueSeverity, bonus = 0): number {
  return severityWeights[severity] + bonus;
}

function profileIdForRole(role: HermesCrewRole): string {
  return HERMES_CREW.find((def) => def.role === role)?.id ?? HERMES_CREW[0]!.id;
}

function recommendTaskAction(task: KanbanTask) {
  if (task.status === "blocked") {
    return {
      kind: "change_task_status",
      label: "Unblock task",
      targetKind: "task",
      targetId: task.id,
      summary: "Add a handoff note and move the task back into active flow.",
      noteRequired: true,
    } as const;
  }
  return {
    kind: "view_logs",
    label: "Inspect task context",
    targetKind: "task",
    targetId: task.id,
    summary: "Review the task body, failures, and recent context before acting.",
  } as const;
}

function buildTaskIssue(task: KanbanTask): HermesCrewIssue | null {
  if (!activeTask(task) || !taskNeedsAttention(task)) return null;
  const profile = taskOwner(task) ?? profileIdForRole("orchestrator");
  const role = HERMES_CREW.find((def) => def.id === profile)?.role ?? "orchestrator";
  const failures = task.consecutiveFailures ?? 0;
  const severity: HermesCrewIssueSeverity = task.status === "blocked" ? "critical" : failures > 1 ? "high" : "medium";
  const status = task.status;
  const title = task.status === "blocked" ? `${task.title} is blocked` : `${task.title} needs attention`;
  const summary = task.body?.trim() || `Task is ${task.status}${failures > 0 ? ` with ${failures} recent failure${failures === 1 ? "" : "s"}` : ""}.`;
  const plain = task.status === "blocked"
    ? `${task.title} is blocking ${role} work and likely needs reassignment, a handoff, or a state change before the lane can recover.`
    : `${task.title} has recent task failures and should be reviewed before more work is queued behind it.`;
  const priorityBonus = Math.max(0, Number(task.priority ?? 0)) * 15 + failures * 10;
  return {
    id: `task:${task.id}`,
    profile,
    role,
    type: "task",
    severity,
    productionImpact: scoreIssue(severity, priorityBonus),
    rank: 0,
    title,
    summary,
    plainEnglish: plain,
    status,
    affectedObjects: [
      {
        kind: "task",
        id: task.id,
        label: task.title,
        status: task.status,
        profile,
        role,
        severity,
        summary: task.body,
        detail: failures > 0 ? `${failures} consecutive failure${failures === 1 ? "" : "s"}` : undefined,
      },
    ],
    recommendedAction: recommendTaskAction(task),
    rawDetail: task.body,
    latestActivity: taskActivity(task) ?? undefined,
    recentActions: [],
  };
}

function buildCronIssue(job: HermesCrewJob, nowMs: number): HermesCrewIssue | null {
  if (job.status !== "failed") return null;
  const profile = profileIdForRole(job.owner);
  const severity: HermesCrewIssueSeverity = job.owner === "incidents" ? "critical" : "high";
  return {
    id: `cron:${job.id}`,
    profile,
    role: job.owner,
    type: "cron",
    severity,
    productionImpact: scoreIssue(severity, job.owner === "incidents" ? 35 : 15),
    rank: 0,
    title: `${job.name} failed`,
    summary: job.lastError ?? "Last cron run failed.",
    plainEnglish: `${job.name} last failed to complete successfully. Review the failure summary before re-running or pausing the job.`,
    status: job.status,
    affectedObjects: [
      {
        kind: "cron",
        id: job.id,
        label: job.name,
        status: job.status,
        profile,
        role: job.owner,
        severity,
        summary: job.schedule,
        detail: job.lastError,
      },
    ],
    recommendedAction: {
      kind: "run_cron",
      label: "Run job now",
      targetKind: "cron",
      targetId: job.id,
      summary: "Re-run the cron job after checking the failure summary.",
    },
    rawDetail: job.lastError,
    latestActivity: jobActivity(job, nowMs) ?? undefined,
    recentActions: [],
  };
}

function buildProfileIssue(def: HermesCrewDefinition, input: BuildCrewInput): HermesCrewIssue | null {
  const source = profileSourceFor(def, input.profiles);
  if (source?.exists) return null;
  const severity: HermesCrewIssueSeverity = def.role === "orchestrator" || def.role === "incidents" ? "high" : "medium";
  return {
    id: `profile:${def.id}`,
    profile: def.id,
    role: def.role,
    type: "profile",
    severity,
    productionImpact: scoreIssue(severity, def.role === "orchestrator" ? 30 : 10),
    rank: 0,
    title: `${def.name} profile is missing`,
    summary: `${def.id} is not created on disk.`,
    plainEnglish: `${def.name} cannot pick up lane work because its Hermes profile is missing from the expected profile directory.`,
    status: "missing",
    affectedObjects: [
      {
        kind: "profile",
        id: def.id,
        label: def.name,
        status: "missing",
        profile: def.id,
        role: def.role,
        severity,
        detail: `Expected profile id: ${def.id}`,
      },
    ],
    recommendedAction: {
      kind: "inspect_config",
      label: "Inspect profile config",
      targetKind: "profile",
      targetId: def.id,
      summary: "Verify the profile exists and is routed to the expected lane.",
    },
    recentActions: [],
  };
}

function buildChannelIssue(def: HermesCrewDefinition, input: BuildCrewInput): HermesCrewIssue | null {
  const privateChannel = channel(def.privateChannel, "private", input.channelNames);
  if (privateChannel.available) return null;
  const severity: HermesCrewIssueSeverity = def.role === "orchestrator" || def.role === "incidents" ? "high" : "medium";
  return {
    id: `channel:${def.privateChannel}`,
    profile: def.id,
    role: def.role,
    type: "channel",
    severity,
    productionImpact: scoreIssue(severity, 20),
    rank: 0,
    title: `#${privateChannel.name} is missing from the directory`,
    summary: `Private channel #${privateChannel.name} is unavailable to Hermes Mission Control.`,
    plainEnglish: `${def.name} is missing its private Discord routing channel in the channel directory, so operator follow-up and lane-specific delivery may be incomplete.`,
    status: "missing",
    affectedObjects: [
      {
        kind: "channel",
        id: privateChannel.id ?? privateChannel.name,
        label: `#${privateChannel.name}`,
        status: "missing",
        profile: def.id,
        role: def.role,
        severity,
      },
    ],
    recommendedAction: {
      kind: "inspect_config",
      label: "Inspect channel mapping",
      targetKind: "channel",
      targetId: privateChannel.name,
      summary: "Confirm the expected private channel exists in the active profile channel directory.",
    },
    recentActions: [],
  };
}

function buildEventIssue(event: HermesCrewActivity): HermesCrewIssue | null {
  if (event.acked) return null;
  const lowered = `${event.status ?? ""} ${event.title} ${event.summary ?? ""}`.toLowerCase();
  if (!["failed", "error", "blocked", "attention", "warn"].some((token) => lowered.includes(token))) return null;
  const profile = normalizeProfileId(event.profile) ?? profileIdForRole(event.role ?? "orchestrator");
  const role = event.role ?? HERMES_CREW.find((def) => def.id === profile)?.role ?? "orchestrator";
  const severity: HermesCrewIssueSeverity = /(failed|error|blocked)/.test(lowered) ? "high" : "medium";
  return {
    id: `event:${event.id}`,
    profile,
    role,
    type: "event",
    severity,
    productionImpact: scoreIssue(severity, 5),
    rank: 0,
    title: event.title,
    summary: event.summary ?? "Mission-control event requires review.",
    plainEnglish: `${event.title} produced a mission-control event that still needs acknowledgement or operator follow-up.`,
    status: event.status,
    affectedObjects: [
      {
        kind: "event",
        id: event.id,
        label: event.title,
        status: event.status,
        profile,
        role,
        severity,
        summary: event.summary,
      },
    ],
    recommendedAction: {
      kind: "ack_event",
      label: "Acknowledge event",
      targetKind: "event",
      targetId: event.id,
      summary: "Acknowledge the event once the issue has been reviewed.",
      noteRequired: false,
    },
    rawDetail: event.summary,
    latestActivity: event,
    recentActions: [],
  };
}

function rankIssues(issues: HermesCrewIssue[]): HermesCrewIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      if (b.productionImpact !== a.productionImpact) return b.productionImpact - a.productionImpact;
      if (a.severity !== b.severity) return severityWeights[b.severity] - severityWeights[a.severity];
      return a.id.localeCompare(b.id);
    })
    .map((issue, index) => ({ ...issue, rank: index + 1 }));
}

function attachRecentActions(issues: HermesCrewIssue[], actionHistory: HermesCrewActionRecord[]): HermesCrewIssue[] {
  const byIssue = new Map<string, HermesCrewActionRecord[]>();
  for (const action of actionHistory) {
    if (!action.issueId) continue;
    const bucket = byIssue.get(action.issueId) ?? [];
    bucket.push(action);
    byIssue.set(action.issueId, bucket);
  }
  return issues.map((issue) => ({
    ...issue,
    recentActions: (byIssue.get(issue.id) ?? []).slice(0, 5),
  }));
}

function buildIssues(
  input: BuildCrewInput,
  jobs: HermesCrewJob[],
  loggedEvents: HermesCrewActivity[],
  nowMs: number,
): HermesCrewIssue[] {
  const issues = [
    ...input.tasks.map(buildTaskIssue),
    ...jobs.map((job) => buildCronIssue(job, nowMs)),
    ...HERMES_CREW.map((def) => buildProfileIssue(def, input)),
    ...HERMES_CREW.map((def) => buildChannelIssue(def, input)),
    ...loggedEvents.map(buildEventIssue),
  ].filter((issue): issue is HermesCrewIssue => Boolean(issue));
  return rankIssues(issues);
}

function profileScorecard(profileId: string, tasks: KanbanTask[], jobs: HermesCrewJob[], issueCount: number, privateChannelAvailable: boolean): HermesCrewScorecard {
  const ownedTasks = tasks.filter((task) => taskOwner(task) === profileId);
  return {
    openTasks: ownedTasks.filter(activeTask).length,
    runningTasks: ownedTasks.filter((task) => task.status === "running").length,
    blockedTasks: ownedTasks.filter((task) => task.status === "blocked").length,
    failedJobs: jobs.filter((job) => profileIdForRole(job.owner) === profileId && job.status === "failed").length,
    missingPrivateChannel: !privateChannelAvailable,
    issueCount,
  };
}

function buildProfile(
  def: HermesCrewDefinition,
  input: BuildCrewInput,
  issues: HermesCrewIssue[],
  actionHistory: HermesCrewActionRecord[],
): HermesCrewProfile {
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
    : issues.length > 0 || attentionCount > 0 || missingChannel ? "attention"
    : runningTasks > 0 ? "running"
    : openTasks > 0 || def.id === input.activeProfile ? "online"
    : "idle";
  const topIssue = issues[0];
  const scorecard = profileScorecard(def.id, input.tasks, input.jobs.map(mapJob), issues.length, privateChannel.available);

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
    attentionCount: issues.length || attentionCount + (missingChannel ? 1 : 0),
    issueCount: issues.length,
    prioritySummary: topIssue
      ? `${topIssue.severity} · ${topIssue.type} · ${topIssue.affectedObjects.length} object${topIssue.affectedObjects.length === 1 ? "" : "s"}`
      : "No active issues",
    topIssueId: topIssue?.id,
    topIssueTitle: topIssue?.title,
    scorecard,
    issues,
    recentActions: actionHistory.filter((action) => action.profile === def.id).slice(0, 5),
    privateChannel,
    publicChannels,
    toolsets: def.toolsets,
  };
}

function buildAttention(issues: HermesCrewIssue[]): string[] {
  return issues.slice(0, 6).map((issue) => `${issue.title}: ${issue.summary}`);
}

export function buildHermesCrewDashboard(input: BuildCrewInput): HermesCrewDashboard {
  const nowMs = input.nowMs ?? Date.now();
  const jobs = input.jobs.map(mapJob);
  const ackedEventIds = input.ackedEventIds ?? new Set<string>();
  const loggedEvents = (input.loggedEvents ?? []).map((event) => ({
    ...event,
    acked: ackedEventIds.has(event.id) || event.acked,
  }));
  const actionHistory = input.actionHistory ?? [];
  const issues = attachRecentActions(buildIssues(input, jobs, loggedEvents, nowMs), actionHistory);
  const crew = HERMES_CREW.map((def) => {
    const profileIssues = issues.filter((issue) => issue.profile === def.id);
    return buildProfile(def, { ...input, nowMs }, profileIssues, actionHistory);
  });
  const channels = [
    ...HERMES_PUBLIC_CHANNELS.map((name) => channel(name, "public", input.channelNames)),
    ...HERMES_CREW.map((def) => channel(def.privateChannel, "private", input.channelNames)),
  ];
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const missingPrivateChannels = crew.filter((profile) => !profile.privateChannel.available);
  const openTasks = input.tasks.filter(activeTask).length;
  const runningTasks = input.tasks.filter((task) => task.status === "running").length;

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
    issues,
    activity: sortedActivities(jobs, input.tasks, loggedEvents, ackedEventIds, nowMs),
    actionHistory,
    documents: mapDocuments(input.notes),
    attention: buildAttention(issues),
    stats: {
      profiles: crew.length,
      availableProfiles: crew.filter((profile) => profile.available).length,
      openTasks,
      runningTasks,
      failedJobs: failedJobs.length,
      missingPrivateChannels: missingPrivateChannels.length,
      activeIssues: issues.length,
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
