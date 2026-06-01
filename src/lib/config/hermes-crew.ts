import type { HermesCrewRole } from "../types.ts";

export interface HermesCrewDefinition {
  id: string;
  name: string;
  role: HermesCrewRole;
  description: string;
  model: string;
  fallbackModel: string;
  reasoning: "medium" | "high";
  privateChannel: string;
  publicChannels: string[];
  toolsets: string[];
  documentHints: string[];
}

export const HERMES_CREW: HermesCrewDefinition[] = [
  {
    id: "refuelrops",
    name: "Refuelr Ops",
    role: "orchestrator",
    description: "Discord-facing router, digests, Kanban decomposition, and operator handoff.",
    model: "gpt-5.4",
    fallbackModel: "gpt-5.3-codex-spark",
    reasoning: "medium",
    privateChannel: "hermes-refuelrops",
    publicChannels: ["hermes-requests", "refuelr-digest"],
    toolsets: ["discord", "kanban", "cronjob", "session_search", "memory", "skills"],
    documentHints: ["ops", "digest", "workflow", "governance", "kanban"],
  },
  {
    id: "refuelr-engineering",
    name: "Engineering",
    role: "engineering",
    description: "Code, debugging, tests, deployment readiness, and repo investigations.",
    model: "gpt-5.4",
    fallbackModel: "gpt-5.3-codex-spark",
    reasoning: "medium",
    privateChannel: "hermes-engineering",
    publicChannels: ["refuelr-eng", "refuelr-deploys", "hermes-requests"],
    toolsets: ["terminal", "file", "browser", "web", "kanban", "session_search", "skills"],
    documentHints: ["engineering", "deploy", "code", "test", "refuelr"],
  },
  {
    id: "refuelr-incidents",
    name: "Incidents",
    role: "incidents",
    description: "Production incidents, Sentry alerts, public health, smoke checks, and data-risk triage.",
    model: "gpt-5.5",
    fallbackModel: "gpt-5.4",
    reasoning: "high",
    privateChannel: "hermes-incidents",
    publicChannels: ["refuelr-alerts", "refuelr-eng", "hermes-requests"],
    toolsets: ["discord", "terminal", "file", "web", "kanban", "session_search", "skills"],
    documentHints: ["incident", "alert", "sentry", "smoke", "health", "postmortem"],
  },
  {
    id: "refuelr-social",
    name: "Social",
    role: "social",
    description: "Social posting operations, content checks, platform health, and post digests.",
    model: "gpt-5.4-mini",
    fallbackModel: "gpt-5.3-codex-spark",
    reasoning: "medium",
    privateChannel: "hermes-social",
    publicChannels: ["refuelr-social-posts", "refuelr-digest", "hermes-requests"],
    toolsets: ["web", "file", "session_search", "skills", "memory"],
    documentHints: ["social", "facebook", "instagram", "post", "content"],
  },
  {
    id: "refuelr-research",
    name: "Research",
    role: "research",
    description: "Source gathering, market scans, documentation research, and Obsidian synthesis.",
    model: "gpt-5.4-mini",
    fallbackModel: "gpt-5.3-codex-spark",
    reasoning: "medium",
    privateChannel: "hermes-research",
    publicChannels: ["hermes-requests", "refuelr-digest"],
    toolsets: ["web", "file", "session_search", "skills", "memory"],
    documentHints: ["research", "market", "competitor", "notes", "source"],
  },
];

export const HERMES_PUBLIC_CHANNELS = [
  "hermes-requests",
  "refuelr-eng",
  "refuelr-alerts",
  "refuelr-social-posts",
  "refuelr-digest",
  "refuelr-deploys",
];

export const HERMES_CREW_ROLE_LABELS: Record<HermesCrewRole, string> = {
  orchestrator: "Orchestrator",
  engineering: "Engineering",
  incidents: "Incidents",
  social: "Social",
  research: "Research",
};
