import "server-only";

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { KanbanTask, TaskStatus } from "@/lib/types";

// node:sqlite requires Node ≥ 22. On older runtimes we degrade gracefully.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryOpenDb(dbPath: string): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const { DatabaseSync } = require("node:sqlite") as any;
    return new DatabaseSync(dbPath, { readOnly: true });
  } catch {
    return null;
  }
}

// Live reader for Hermes' kanban (hermes_cli/kanban_db.py). Reads the SQLite
// `tasks` table directly via Node's built-in node:sqlite — no native deps, no
// Python, no hermes CLI. Server-only.

const VALID_STATUSES: TaskStatus[] = [
  "triage",
  "todo",
  "scheduled",
  "ready",
  "running",
  "blocked",
  "review",
  "done",
  "archived",
];

/** Resolve the kanban.db path: $HERMES_KANBAN_DB or ~/.hermes/kanban.db. */
export function resolveDbPath(): string {
  return process.env.HERMES_KANBAN_DB || path.join(os.homedir(), ".hermes", "kanban.db");
}

export function dbExists(dbPath = resolveDbPath()): boolean {
  try {
    return fs.statSync(dbPath).isFile();
  } catch {
    return false;
  }
}

// --- helpers ----------------------------------------------------------------

/** Epoch (seconds or ms) -> "just now" / "12m ago" / "3h ago" / "2d ago". */
function ago(epoch: unknown): string | undefined {
  if (epoch == null) return undefined;
  let ms = Number(epoch);
  if (!Number.isFinite(ms)) return undefined;
  if (ms < 1e12) ms *= 1000; // seconds -> ms
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

/** Duration since an epoch -> "4m 12s" / "1h 03m". */
function durationSince(epoch: unknown): string | undefined {
  if (epoch == null) return undefined;
  let ms = Number(epoch);
  if (!Number.isFinite(ms)) return undefined;
  if (ms < 1e12) ms *= 1000;
  let s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function parseSkills(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return undefined;
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // not JSON — treat as comma-separated
    }
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return undefined;
}

type DbRow = Record<string, unknown>;

/** Best-effort dependency counts from task_links, auto-detecting the child FK column. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function depCounts(db: any): Map<string, number> {
  const out = new Map<string, number>();
  try {
    const cols = (db.prepare("PRAGMA table_info(task_links)").all() as DbRow[]).map((r) => String(r.name));
    const childCol = ["child_id", "child", "to_task", "to_id", "dependent_id", "task_id", "downstream"].find((c) =>
      cols.includes(c),
    );
    if (!childCol) return out;
    const rows = db.prepare(`SELECT ${childCol} AS c, COUNT(*) AS n FROM task_links GROUP BY ${childCol}`).all();
    for (const r of rows) out.set(String(r.c), Number(r.n));
  } catch {
    // table absent or unexpected shape — deps just won't show
  }
  return out;
}

/**
 * Read tasks from the kanban DB. Synchronous (node:sqlite DatabaseSync).
 * Throws if the DB can't be opened/read — callers fall back to mock.
 */
export function readTasks(dbPath = resolveDbPath()): KanbanTask[] {
  const db = tryOpenDb(dbPath);
  if (!db) return [];
  try {
    const deps = depCounts(db);
    const rows = db
      .prepare(
        `SELECT id, title, body, assignee, status, priority, skills, branch_name,
                workspace_kind, created_at, started_at, completed_at, consecutive_failures
         FROM tasks
         ORDER BY priority DESC, created_at ASC`,
      )
      .all() as DbRow[];

    return rows.map((r): KanbanTask => {
      const status = (VALID_STATUSES.includes(r.status as TaskStatus) ? r.status : "triage") as TaskStatus;
      const id = String(r.id);
      return {
        id,
        title: String(r.title ?? "Untitled"),
        body: r.body ? String(r.body) : undefined,
        status,
        priority: Number(r.priority ?? 0),
        assignee: r.assignee ? String(r.assignee) : undefined,
        skills: parseSkills(r.skills),
        branchName: r.branch_name ? String(r.branch_name) : undefined,
        workspaceKind: r.workspace_kind ? String(r.workspace_kind) : undefined,
        createdAt: ago(r.created_at) ?? "—",
        startedAt: ago(r.started_at),
        completedAt: ago(r.completed_at),
        deps: deps.get(id),
        consecutiveFailures: Number(r.consecutive_failures ?? 0) || undefined,
        runtime: status === "running" ? durationSince(r.started_at) : undefined,
      };
    });
  } finally {
    db.close();
  }
}
