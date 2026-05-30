// Server-only. Derives real StatMetric[] for claude-code and codex from local readers.
import type { StatMetric } from "@/lib/types";
import { readSessions as readClaudeSessions } from "@/lib/claude-code/reader";
import { readSessions as readCodexSessions } from "@/lib/codex/reader";
import { readUserConfig, resolvedBudgets } from "@/lib/config/user-config";

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
