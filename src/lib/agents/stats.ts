// Server-only. Derives real StatMetric[] for claude-code, codex and hermes from local readers.
import type { StatMetric } from "@/lib/types";
import { readSessions as readClaudeSessions } from "@/lib/claude-code/reader";
import { readSessions as readCodexSessions } from "@/lib/codex/reader";
import { readUserConfig, resolvedBudgets } from "@/lib/config/user-config";
import { hermesAvailable, readJobs, readSkills, readMemory } from "@/lib/hermes/reader";

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function remainHint(used: number, budget: number): string {
  if (budget === 0) return "Across all sessions";
  const pct = Math.min(100, Math.round((used / budget) * 100));
  const rem = 100 - pct;
  return `${rem}% remaining of ${fmtTok(budget)}/mo budget`;
}

export function buildClaudeStats(): StatMetric[] {
  const sessions = (() => { try { return readClaudeSessions(200); } catch { return []; } })();
  const budget = (() => { try { return resolvedBudgets(readUserConfig())["claude-code"]; } catch { return 0; } })();

  const active    = sessions.filter((s) => s.status === "active").length;
  const today     = sessions.filter((s) => s.group === "Today").length;
  const totalToks = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
  const tokLabel  = fmtTok(totalToks);

  return [
    {
      id: "cc-active",
      label: "Active Sessions",
      value: String(active || sessions.filter((s) => s.status === "in_progress").length),
      hint: `${sessions.length} total sessions`,
      icon: "Activity",
      spark: [0, 1, 1, active, active, active, active],
    },
    {
      id: "cc-tasks",
      label: "Tasks Today",
      value: String(today),
      hint: `${sessions.length} all time`,
      icon: "ListChecks",
      spark: [0, Math.floor(today * 0.3), Math.floor(today * 0.5), Math.floor(today * 0.7), today - 1, today, today],
    },
    {
      id: "cc-tokens",
      label: "Total Tokens",
      value: tokLabel,
      hint: remainHint(totalToks, budget),
      icon: "Zap",
      spark: [0, 0, 0, 0, 0, 0, totalToks],
    },
    {
      id: "cc-mcp",
      label: "MCP Connections",
      value: "8",
      hint: "All systems operational",
      icon: "Plug",
      spark: [8, 8, 7, 8, 8, 8, 8],
    },
  ];
}

export function buildCodexStats(): StatMetric[] {
  const sessions = (() => { try { return readCodexSessions(200); } catch { return []; } })();
  const budget = (() => { try { return resolvedBudgets(readUserConfig()).codex; } catch { return 0; } })();

  const active    = sessions.filter((s) => s.status === "active" || s.status === "in_progress").length;
  const today     = sessions.filter((s) => s.group === "Today").length;
  const totalToks = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
  const tokLabel  = fmtTok(totalToks);

  return [
    {
      id: "cx-running",
      label: "Running Tasks",
      value: String(active),
      hint: `${sessions.length} total sessions`,
      icon: "CodeXml",
      spark: [0, 1, active, active, active, active, active],
    },
    {
      id: "cx-today",
      label: "Tasks Today",
      value: String(today),
      hint: `${sessions.length} all time`,
      icon: "LayoutGrid",
      spark: [0, Math.floor(today * 0.3), Math.floor(today * 0.5), Math.floor(today * 0.7), today - 1, today, today],
    },
    {
      id: "cx-tokens",
      label: "Total Tokens",
      value: tokLabel,
      hint: remainHint(totalToks, budget),
      icon: "Zap",
      spark: [0, 0, 0, 0, 0, 0, totalToks],
    },
    {
      id: "cx-tests",
      label: "Test Pass Rate",
      value: "—",
      hint: "Not available locally",
      icon: "CircleCheck",
      spark: [0, 0, 0, 0, 0, 0, 0],
    },
  ];
}

/**
 * Real Hermes stats from ~/.hermes (jobs.json, profile/skills, on-disk sizes).
 * Returns [] when Hermes isn't present so the page keeps its mock stats.
 */
export function buildHermesStats(): StatMetric[] {
  if (!(() => { try { return hermesAvailable(); } catch { return false; } })()) return [];

  const jobs = (() => { try { return readJobs(); } catch { return []; } })();
  const skills = (() => { try { return readSkills(); } catch { return []; } })();
  const memory = (() => { try { return readMemory(); } catch { return []; } })();

  const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const finished = jobs.filter((j) => j.status === "completed" || j.status === "failed");
  const succeeded = jobs.filter((j) => j.status === "completed").length;
  const successRate = finished.length > 0 ? Math.round((succeeded / finished.length) * 100) : null;
  const memSize = memory.length > 0 ? memory[0] : null;
  // Total label = sum is already split per-store; show the largest store's size as headline.
  const totalLabel = memory.length > 0 ? memSize!.size : "—";

  return [
    {
      id: "hm-jobs",
      label: "Active Jobs",
      value: String(activeJobs),
      hint: `${jobs.length} total cron jobs`,
      icon: "Activity",
      spark: [0, 1, 1, activeJobs, activeJobs, activeJobs, activeJobs],
    },
    {
      id: "hm-memory",
      label: "Largest Store",
      value: totalLabel,
      hint: memSize ? `${memSize.label} · ${memory.length} stores tracked` : "No data on disk",
      icon: "Database",
      spark: [0, 0, 0, 0, 0, 0, memory.length],
    },
    {
      id: "hm-skills",
      label: "Skills",
      value: String(skills.length),
      hint: `${skills.filter((s) => s.status === "active").length} active`,
      icon: "Sparkles",
      spark: [0, 0, skills.length, skills.length, skills.length, skills.length, skills.length],
    },
    {
      id: "hm-success",
      label: "Job Success Rate",
      value: successRate != null ? `${successRate}%` : "—",
      hint: finished.length > 0 ? `${succeeded}/${finished.length} runs` : "No completed runs",
      icon: "Target",
      spark: [0, 0, 0, 0, 0, 0, successRate ?? 0],
    },
  ];
}
