// Server-only. Builds real AgentSummary[] by inspecting local session files and processes.
import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";
import { readSessions as readClaudeSessions } from "@/lib/claude-code/reader";
import { readSessions as readCodexSessions } from "@/lib/codex/reader";
import { AGENTS } from "@/lib/config/agents";
import type { AgentSummary } from "@/lib/types";

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

export function buildAgentSummaries(): AgentSummary[] {
  const cfg = AGENTS;

  // ── Claude Code ─────────────────────────────────────────────────────────────
  const claudeSessions = (() => {
    try { return readClaudeSessions(5); } catch { return []; }
  })();
  const claudeLatest = claudeSessions[0];
  const claudeActive = claudeSessions.find((s) => s.status === "active");

  // ── Codex ────────────────────────────────────────────────────────────────────
  const codexSessions = (() => {
    try { return readCodexSessions(5); } catch { return []; }
  })();
  const codexLatest = codexSessions[0];
  const codexActive = codexSessions.find(
    (s) => s.status === "active" || s.status === "in_progress",
  );

  // ── Hermes ───────────────────────────────────────────────────────────────────
  const hermesInstalled = binExists("hermes");

  // ── Obsidian ─────────────────────────────────────────────────────────────────
  // On a headless Ubuntu server, Obsidian GUI never runs — detect vault presence instead.
  const vaultPath = process.env.VAULT_PATH;
  const obsidianRunning = vaultPath
    ? (() => {
        try {
          return fs.existsSync(vaultPath) && fs.statSync(vaultPath).isDirectory();
        } catch {
          return false;
        }
      })()
    : processRunning("Obsidian");

  const claudeLimitHit = claudeSessions[0]?.hitLimit ?? false;
  const codexLimitHit = codexSessions[0]?.hitLimit ?? false;

  return [
    {
      id: "claude-code",
      name: cfg["claude-code"].name,
      tagline: cfg["claude-code"].tagline,
      status: claudeLimitHit ? "degraded" : claudeActive ? "running" : claudeLatest ? "online" : "offline",
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
      lastSessionAgo: codexLatest?.updatedAt ?? "—",
      currentTask: codexActive?.title ?? codexLatest?.title ?? "No active session",
      workspace: codexActive?.workspace ?? codexLatest?.workspace ?? "—",
      uptime: codexActive ? "active" : undefined,
    },
    {
      id: "hermes",
      name: cfg["hermes"].name,
      tagline: cfg["hermes"].tagline,
      status: hermesInstalled ? "online" : "offline",
      lastSessionAgo: "—",
      currentTask: hermesInstalled ? "CLI available" : "Not installed on this host",
      workspace: hermesInstalled ? "hermes-agent" : "—",
    },
    {
      id: "obsidian",
      name: cfg["obsidian"].name,
      tagline: cfg["obsidian"].tagline,
      status: obsidianRunning ? "running" : "offline",
      lastSessionAgo: "—",
      currentTask: obsidianRunning ? "Vault open" : "Not running",
      workspace: obsidianRunning ? "Refuelr" : "—",
    },
  ];
}
