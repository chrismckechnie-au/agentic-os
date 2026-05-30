import type { AgentId } from "@/lib/types";

// UI configuration per agent: identity, accent color, icon, and the tab set
// shown in its workspace. Plain data so it's safe to import on server or client.

export interface AgentTab {
  id: string;
  label: string;
}

export interface AgentConfig {
  id: AgentId;
  name: string;
  tagline: string;
  /** Primary accent (hex). Drives the per-page --accent CSS variable. */
  accent: string;
  /** Lucide icon key (see components/icon.tsx). */
  icon: string;
  tabs: AgentTab[];
  /**
   * If set, this agent has a real local CLI that can run live in a PTY terminal
   * (see /api/pty in server.mjs). Presence gates the UI's "Start live session"
   * control. The server keeps its own authoritative allowlist — this is UI hint
   * only. The binary name is shown to the user; it only runs where it's installed.
   */
  liveCli?: { bin: string };
}

export const AGENTS: Record<AgentId, AgentConfig> = {
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    tagline: "AI assistant for coding, debugging and refactoring.",
    accent: "#e8682c",
    icon: "Sparkles",
    liveCli: { bin: "claude" },
    tabs: [
      { id: "terminal", label: "Terminal" },
      { id: "files", label: "Files" },
      { id: "mcp", label: "MCP Tools" },
      { id: "settings", label: "Settings" },
    ],
  },
  codex: {
    id: "codex",
    name: "Codex",
    tagline: "OpenAI coding agent for autonomous development.",
    accent: "#10b981",
    icon: "CodeXml",
    liveCli: { bin: "codex" },
    tabs: [
      { id: "terminal", label: "Terminal" },
      { id: "plan", label: "Plan" },
      { id: "changes", label: "Changes" },
      { id: "tests", label: "Tests" },
      { id: "logs", label: "Logs" },
    ],
  },
  hermes: {
    id: "hermes",
    name: "Hermes",
    tagline: "Autonomous AI agent for research and automation.",
    accent: "#a855f7",
    icon: "Send",
    liveCli: { bin: "hermes" },
    tabs: [
      { id: "terminal", label: "Terminal" },
      { id: "memory", label: "Memory" },
      { id: "skills", label: "Skills" },
      { id: "jobs", label: "Jobs" },
      { id: "settings", label: "Settings" },
    ],
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian",
    tagline: "Knowledge management and note-taking.",
    accent: "#9d7cff",
    icon: "Hexagon",
    tabs: [
      { id: "terminal", label: "Terminal" },
      { id: "notes", label: "Notes" },
      { id: "graph", label: "Graph" },
      { id: "settings", label: "Settings" },
    ],
  },
};

export const AGENT_ORDER: AgentId[] = ["claude-code", "codex", "hermes", "obsidian"];

export function isAgentId(value: string): value is AgentId {
  return value in AGENTS;
}
