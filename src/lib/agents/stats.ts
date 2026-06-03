// Server-only. Derives real StatMetric[] for claude-code, codex and hermes from local readers.
import type { StatMetric } from "@/lib/types";
import { readSessions as readClaudeSessions, type ClaudeSession } from "@/lib/claude-code/reader";
import { readSessions as readCodexSessions, type CodexSession } from "@/lib/codex/reader";
import { hermesAvailable, readJobs, readSkills, readMemory } from "@/lib/hermes/reader";
import { readNotes, readVaultStats } from "@/lib/obsidian/reader";

type ActivityMetricSession = {
  status: string;
  group: string;
  workspace?: string | null;
  cwd?: string | null;
};

const THIS_WEEK_GROUPS = new Set(["Today", "Yesterday", "Previous 7 days"]);

function countDistinctWorkspaces(sessions: ActivityMetricSession[]): number {
  return new Set(
    sessions
      .map((session) => session.workspace ?? session.cwd ?? null)
      .filter((value): value is string => Boolean(value)),
  ).size;
}

function buildSharedActivityStats(
  sessions: ActivityMetricSession[],
  ids: { active: string; today: string; week: string; workspaces: string },
): StatMetric[] {
  const active = sessions.filter((s) => s.status === "active" || s.status === "in_progress").length;
  const today = sessions.filter((s) => s.group === "Today").length;
  const thisWeek = sessions.filter((s) => THIS_WEEK_GROUPS.has(s.group)).length;
  const workspaces = countDistinctWorkspaces(sessions);

  return [
    {
      id: ids.active,
      label: "Active Sessions",
      value: String(active),
      hint: `${sessions.length} total sessions`,
      icon: "Activity",
    },
    {
      id: ids.today,
      label: "Tasks Today",
      value: String(today),
      hint: `${thisWeek} sessions this week`,
      icon: "ListChecks",
    },
    {
      id: ids.week,
      label: "Sessions This Week",
      value: String(thisWeek),
      hint: "Today, yesterday, and the previous 7 days",
      icon: "Clock",
    },
    {
      id: ids.workspaces,
      label: "Workspaces Touched",
      value: String(workspaces),
      hint: "Distinct workspaces across indexed sessions",
      icon: "FolderGit2",
    },
  ];
}

export function buildClaudeStats(sessions?: ClaudeSession[]): StatMetric[] {
  sessions ??= (() => { try { return readClaudeSessions(200); } catch { return []; } })();
  return buildSharedActivityStats(sessions, {
    active: "cc-active",
    today: "cc-tasks",
    week: "cc-week",
    workspaces: "cc-workspaces",
  });
}

export function buildCodexStats(sessions?: CodexSession[]): StatMetric[] {
  sessions ??= (() => { try { return readCodexSessions(200); } catch { return []; } })();
  return buildSharedActivityStats(sessions, {
    active: "cx-active",
    today: "cx-tasks",
    week: "cx-week",
    workspaces: "cx-workspaces",
  });
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

export function buildObsidianStats(): StatMetric[] {
  const notes = (() => {
    try {
      return readNotes(200);
    } catch {
      return [];
    }
  })();
  const vault = (() => {
    try {
      return readVaultStats();
    } catch {
      return { notes: 0, links: 0, vaultName: "—" };
    }
  })();

  const updatedToday = notes.filter((note) => {
    const timestamp = new Date(note.updatedAt).getTime();
    if (!Number.isFinite(timestamp)) return false;
    return Date.now() - timestamp < 86_400_000;
  }).length;

  return [
    {
      id: "ob-notes",
      label: "Notes",
      value: vault.notes.toLocaleString(),
      hint: vault.vaultName === "—" ? "Vault path unavailable" : vault.vaultName,
      icon: "FileText",
      spark: [0, 0, 0, 0, 0, 0, vault.notes],
    },
    {
      id: "ob-links",
      label: "Backlinks",
      value: vault.links.toLocaleString(),
      hint: `${updatedToday} updated in the last 24h`,
      icon: "Link2",
      spark: [0, 0, 0, 0, 0, 0, vault.links],
    },
    {
      id: "ob-recent",
      label: "Tags",
      value: String(vault.tags ?? 0),
      hint: `${updatedToday} notes updated in the last 24h`,
      icon: "Hash",
      spark: [0, 0, 0, 0, 0, 0, vault.tags ?? 0],
    },
    {
      id: "ob-status",
      label: "Open Tasks",
      value: String(vault.openTasks ?? 0),
      hint: vault.vaultName === "—" ? "Set VAULT_PATH on the host" : `${vault.tasks ?? 0} tasks indexed`,
      icon: "ListChecks",
      spark: [0, 0, 0, 0, 0, 0, vault.openTasks ?? 0],
    },
  ];
}
