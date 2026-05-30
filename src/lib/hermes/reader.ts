import "server-only";

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { Job, MemoryStore, SessionStatus, Skill } from "@/lib/types";

// Live reader for the Hermes agent (Nous Research hermes-agent), modelled on the
// official refuelr-ops dashboard plugin (`plugin_api.py`). Reads the real
// ~/.hermes layout directly via node:fs — no hermes process, no Python. All
// readers degrade to empty/graceful fallback when the home dir is absent, so the
// page falls back to mock. Server-only.

/** Resolve the Hermes home: $HERMES_HOME or ~/.hermes (matches get_hermes_home()). */
export function resolveHermesHome(): string {
  return process.env.HERMES_HOME || path.join(/* turbopackIgnore: true */ os.homedir(), ".hermes");
}

export function hermesAvailable(home = resolveHermesHome()): boolean {
  try {
    return fs.statSync(home).isDirectory();
  } catch {
    return false;
  }
}

// --- helpers ----------------------------------------------------------------

function humanBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** Recursive on-disk size of a file or directory, best-effort. */
function pathSize(target: string): number {
  let total = 0;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(target);
  } catch {
    return 0;
  }
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(target, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) total += pathSize(full);
    else if (entry.isFile()) {
      try {
        total += fs.statSync(full).size;
      } catch {
        /* skip */
      }
    }
  }
  return total;
}

type JobRecord = Record<string, unknown>;

/** Read raw job records from cron/jobs.json (array or { jobs: [...] }). */
function loadJobRecords(home = resolveHermesHome()): JobRecord[] {
  const file = path.join(home, "cron", "jobs.json");
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  try {
    const payload = JSON.parse(raw);
    if (Array.isArray(payload)) return payload as JobRecord[];
    if (payload && Array.isArray(payload.jobs)) return payload.jobs as JobRecord[];
  } catch {
    /* malformed */
  }
  return [];
}

function statusFromLast(lastStatus: unknown, enabled: boolean): SessionStatus {
  const s = String(lastStatus ?? "").toLowerCase();
  if (s === "success" || s === "ok" || s === "completed") return "completed";
  if (s === "error" || s === "failed" || s === "failure") return "failed";
  if (s === "running") return "running";
  return enabled ? "queued" : "paused";
}

// --- public API -------------------------------------------------------------

export function readJobs(home = resolveHermesHome()): Job[] {
  return loadJobRecords(home).map((j): Job => {
    const enabled = j.enabled === undefined ? true : Boolean(j.enabled);
    return {
      id: j.id != null ? String(j.id) : undefined,
      name: String(j.name ?? j.id ?? "Untitled job"),
      status: statusFromLast(j.last_status, enabled),
      schedule: j.schedule_display ? String(j.schedule_display) : undefined,
    };
  });
}

export function readSkills(home = resolveHermesHome()): Skill[] {
  const root = path.join(home, "profile", "skills");
  const found = new Map<string, boolean>(); // name -> isActive

  // Skill names referenced by any enabled job count as "active".
  const activeNames = new Set<string>();
  for (const j of loadJobRecords(home)) {
    const enabled = j.enabled === undefined ? true : Boolean(j.enabled);
    if (!enabled) continue;
    const skills = j.skills;
    if (Array.isArray(skills)) for (const s of skills) activeNames.add(String(s).toLowerCase());
  }

  // Walk profile/skills/**, collecting dirs that look like a skill (contain a
  // SKILL.md / manifest) or leaf dirs.
  const walk = (dir: string, depth: number) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const subdirs = entries.filter((e) => e.isDirectory());
    const files = entries.filter((e) => e.isFile()).map((e) => e.name.toLowerCase());
    const looksLikeSkill =
      files.includes("skill.md") || files.includes("manifest.json") || files.some((f) => f.endsWith(".skill"));
    if (looksLikeSkill || (depth > 0 && subdirs.length === 0)) {
      const name = path.basename(dir);
      found.set(name, activeNames.has(name.toLowerCase()));
      return;
    }
    for (const sd of subdirs) walk(path.join(dir, sd.name), depth + 1);
  };
  walk(root, 0);

  const skills = [...found.entries()].map(([name, active]): Skill => ({
    name,
    status: active ? "active" : "idle",
  }));
  skills.sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return skills;
}

export function readMemory(home = resolveHermesHome()): MemoryStore[] {
  const targets: { label: string; rel: string[] }[] = [
    { label: "kanban", rel: ["kanban.db"] },
    { label: "job output", rel: ["cron", "output"] },
    { label: "skills", rel: ["profile", "skills"] },
    { label: "plugins", rel: ["plugins"] },
  ];
  const sized = targets
    .map((t) => ({ label: t.label, bytes: pathSize(path.join(home, ...t.rel)) }))
    .filter((t) => t.bytes > 0);
  const total = sized.reduce((sum, t) => sum + t.bytes, 0);
  if (total === 0) return [];
  return sized
    .sort((a, b) => b.bytes - a.bytes)
    .map((t): MemoryStore => ({
      label: t.label,
      size: humanBytes(t.bytes),
      pct: Math.round((t.bytes / total) * 100),
    }));
}
