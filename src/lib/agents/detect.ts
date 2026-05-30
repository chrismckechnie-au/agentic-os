// Server-only. Builds real AgentSummary[] by inspecting local session files and processes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { AGENTS } from "@/lib/config/agents";
import type { AgentSummary } from "@/lib/types";
import { readNotes } from "@/lib/obsidian/reader";
import { getStateDbHealth } from "@/lib/hermes/state";
import {
  readLiveSessionSnapshot,
  type LiveSessionSnapshot,
} from "@/lib/providers/live/session-snapshot";

const isWin = os.platform() === "win32";

function binExists(bin: string): boolean {
  try {
    execSync(isWin ? `where ${bin}` : `command -v ${bin}`, { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function processRunning(exeName: string): boolean {
  try {
    if (isWin) {
      const out = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH 2>nul`, {
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      })
        .toString()
        .toLowerCase();
      return out.includes(exeName.toLowerCase());
    } else {
      execSync(`pgrep -xi "${exeName}"`, { stdio: "ignore", timeout: 3000 });
      return true;
    }
  } catch {
    return false;
  }
}

export function buildAgentSummaries(
  snapshot: LiveSessionSnapshot = readLiveSessionSnapshot(),
): AgentSummary[] {
  const cfg = AGENTS;
  const claudeCliAvailable = Boolean(cfg["claude-code"].liveCli && binExists(cfg["claude-code"].liveCli.bin));
  const codexCliAvailable = Boolean(cfg.codex.liveCli && binExists(cfg.codex.liveCli.bin));
  const hermesCliAvailable = Boolean(cfg.hermes.liveCli && binExists(cfg.hermes.liveCli.bin));

  // ── Claude Code ─────────────────────────────────────────────────────────────
  const claudeSessions = snapshot.claude.slice(0, 5);
  const claudeLatest = claudeSessions[0];
  const claudeActive = claudeSessions.find((s) => s.status === "active");

  // ── Codex ────────────────────────────────────────────────────────────────────
  const codexSessions = snapshot.codex.slice(0, 5);
  const codexLatest = codexSessions[0];
  const codexActive = codexSessions.find(
    (s) => s.status === "active" || s.status === "in_progress",
  );

  // ── Hermes ───────────────────────────────────────────────────────────────────
  const hermesStateHealth = getStateDbHealth();

  // ── Obsidian ─────────────────────────────────────────────────────────────────
  const vaultPath = process.env.VAULT_PATH;
  const obsidianAvailable = vaultPath
    ? (() => {
        try {
          return fs.existsSync(vaultPath) && fs.statSync(vaultPath).isDirectory();
        } catch {
          return false;
        }
      })()
    : processRunning("Obsidian");
  const latestNote = (() => {
    try {
      return readNotes(1)[0];
    } catch {
      return undefined;
    }
  })();

  const claudeLimitHit = claudeSessions[0]?.hitLimit ?? false;
  const codexLimitHit = codexSessions[0]?.hitLimit ?? false;

  return [
    {
      id: "claude-code",
      name: cfg["claude-code"].name,
      tagline: cfg["claude-code"].tagline,
      status: claudeLimitHit ? "degraded" : claudeActive ? "running" : claudeLatest ? "online" : "offline",
      liveCliAvailable: claudeCliAvailable,
      lastSessionAgo: claudeLatest?.updatedAt ?? "—",
      currentTask: claudeActive?.title ?? claudeLatest?.title ?? "No active session",
      workspace: claudeActive?.workspace ?? claudeLatest?.workspace ?? "—",
      uptime: claudeActive ? "active" : undefined,
    },
    {
      id: "codex",
      name: cfg["codex"].name,
      tagline: cfg["codex"].tagline,
      status: codexLimitHit ? "degraded" : codexActive ? "running" : codexLatest ? "online" : "offline",
      liveCliAvailable: codexCliAvailable,
      lastSessionAgo: codexLatest?.updatedAt ?? "—",
      currentTask: codexActive?.title ?? codexLatest?.title ?? "No active session",
      workspace: codexActive?.workspace ?? codexLatest?.workspace ?? "—",
      uptime: codexActive ? "active" : undefined,
    },
    {
      id: "hermes",
      name: cfg["hermes"].name,
      tagline: cfg["hermes"].tagline,
      status: !hermesCliAvailable ? "offline" : hermesStateHealth.available && !hermesStateHealth.readable ? "degraded" : "online",
      liveCliAvailable: hermesCliAvailable,
      lastSessionAgo: "—",
      currentTask:
        !hermesCliAvailable ? "CLI not installed on this host"
        : hermesStateHealth.available && !hermesStateHealth.readable ? hermesStateHealth.reason
        : "CLI available",
      workspace: hermesCliAvailable ? "hermes-agent" : "—",
    },
    {
      id: "obsidian",
      name: cfg["obsidian"].name,
      tagline: cfg["obsidian"].tagline,
      status: obsidianAvailable ? "online" : "offline",
      liveCliAvailable: false,
      lastSessionAgo: latestNote?.updatedAt ?? "—",
      currentTask: obsidianAvailable ? latestNote?.title ?? "Vault available" : "Vault unavailable",
      workspace: obsidianAvailable ? (vaultPath ? path.basename(vaultPath) : "Vault") : "—",
    },
  ];
}

export function summarizeSystemState(
  agents: AgentSummary[],
): { state: "healthy" | "running" | "degraded" | "down"; label: string } {
  const down = agents.filter((agent) => agent.status === "offline").length;
  const degraded = agents.filter((agent) => agent.status === "degraded").length;
  const running = agents.filter((agent) => agent.status === "running").length;

  if (down === agents.length) {
    return { state: "down", label: "No agents available" };
  }
  if (down > 0 || degraded > 0) {
    return {
      state: "degraded",
      label: `${down + degraded} agent${down + degraded === 1 ? "" : "s"} need attention`,
    };
  }
  if (running > 0) {
    return {
      state: "running",
      label: `${running} agent${running === 1 ? "" : "s"} running`,
    };
  }
  return { state: "healthy", label: "System ready" };
}
