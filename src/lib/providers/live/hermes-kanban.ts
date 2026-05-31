import "server-only";

import path from "node:path";
import fs from "node:fs";
import type {
  KanbanComment,
  KanbanEvent,
  KanbanLinkRef,
  KanbanRun,
  KanbanTask,
  KanbanTaskDetail,
  TaskStatus,
} from "@/lib/types";
import { resolveHermesHome } from "@/lib/hermes/paths";

// node:sqlite requires Node ≥ 22. On older runtimes we degrade gracefully.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadSqlite(): any | null {
  try {
    const builtinLoader = (
      process as NodeJS.Process & {
        getBuiltinModule?: (id: string) => unknown;
      }
    ).getBuiltinModule;
    if (typeof builtinLoader === "function") {
      return builtinLoader("node:sqlite");
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("node:sqlite");
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryOpenDb(dbPath: string): any | null {
  try {
    const sqlite = loadSqlite();
    const DatabaseSync = sqlite?.DatabaseSync;
    if (!DatabaseSync) return null;
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

export interface KanbanDbResolution {
  dbPath: string;
  boardSlug?: string;
  resolution: "env-db" | "env-board" | "current-board" | "default-board" | "legacy-db";
  reason?: string;
}

function hermesHome(): string {
  return resolveHermesHome();
}

function boardDbPath(slug: string): string {
  return path.join(hermesHome(), "kanban", "boards", slug, "kanban.db");
}

/** Resolve the kanban DB using Hermes' active-board precedence. */
export function resolveDb(): KanbanDbResolution {
  const explicit = process.env.HERMES_KANBAN_DB?.trim();
  if (explicit) return { dbPath: explicit, resolution: "env-db" };

  const boardFromEnv = process.env.HERMES_KANBAN_BOARD?.trim();
  if (boardFromEnv) {
    return { dbPath: boardDbPath(boardFromEnv), boardSlug: boardFromEnv, resolution: "env-board" };
  }

  const currentFile = path.join(hermesHome(), "kanban", "current");
  try {
    const current = fs.readFileSync(currentFile, "utf-8").trim();
    if (current) {
      return { dbPath: boardDbPath(current), boardSlug: current, resolution: "current-board" };
    }
  } catch {
    // fall through
  }

  const defaultDb = boardDbPath("default");
  if (dbExists(defaultDb)) {
    return { dbPath: defaultDb, boardSlug: "default", resolution: "default-board" };
  }

  return {
    dbPath: path.join(hermesHome(), "kanban.db"),
    resolution: "legacy-db",
    reason: "No active Hermes board found; using legacy ~/.hermes/kanban.db",
  };
}

/** Resolve the kanban.db path; prefer resolveDb() when source details matter. */
export function resolveDbPath(): string {
  return resolveDb().dbPath;
}

export function dbExists(dbPath = resolveDbPath()): boolean {
  try {
    return fs.statSync(dbPath).isFile();
  } catch {
    return false;
  }
}

export function getDbHealth(dbPath = resolveDbPath()): {
  available: boolean;
  readable: boolean;
  dbPath: string;
  reason?: string;
} {
  if (!dbExists(dbPath)) {
    return { available: false, readable: false, dbPath };
  }

  const db = tryOpenDb(dbPath);
  if (!db) {
    return {
      available: true,
      readable: false,
      dbPath,
      reason: "node:sqlite is unavailable; run the service on Node 22+",
    };
  }

  try {
    return { available: true, readable: true, dbPath };
  } finally {
    db.close();
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
  if (!db) {
    throw new Error("node:sqlite is unavailable; run the service on Node 22+");
  }
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

    return rows.map((r): KanbanTask => mapTaskRow(r, deps.get(String(r.id))));
  } finally {
    db.close();
  }
}

function mapTaskRow(r: DbRow, depCount?: number): KanbanTask {
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
    deps: depCount,
    consecutiveFailures: Number(r.consecutive_failures ?? 0) || undefined,
    runtime: status === "running" ? durationSince(r.started_at) : undefined,
  };
}

/** Duration between two epochs -> "4m 12s" / "1h 03m". */
function durationBetween(start: unknown, end: unknown): string | undefined {
  const a = Number(start);
  const b = Number(end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  const ms = (b < 1e12 ? b * 1000 : b) - (a < 1e12 ? a * 1000 : a);
  if (ms < 0) return undefined;
  let s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Best-effort one-line summary from a JSON event payload. */
function summarizePayload(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object") {
      const pick = obj.message ?? obj.summary ?? obj.status ?? obj.detail ?? obj.note;
      if (pick != null) return String(pick).replace(/\s+/g, " ").slice(0, 200);
      return Object.keys(obj).slice(0, 4).join(", ").slice(0, 200) || undefined;
    }
  } catch {
    // not JSON — fall through to a raw snippet
  }
  return text.replace(/\s+/g, " ").slice(0, 200);
}

/** Max task_events.id — a cheap change cursor clients poll for live refresh. */
export function readBoardCursor(dbPath = resolveDbPath()): number {
  const db = tryOpenDb(dbPath);
  if (!db) return 0;
  try {
    const r = db.prepare("SELECT COALESCE(MAX(id), 0) AS c FROM task_events").get() as DbRow;
    return Number(r?.c ?? 0);
  } catch {
    return 0;
  } finally {
    db.close();
  }
}

/** Full task drawer payload: task + comments, links, runs, recent events. */
export function readTaskDetail(id: string, dbPath = resolveDbPath()): KanbanTaskDetail | null {
  const db = tryOpenDb(dbPath);
  if (!db) return null;
  try {
    const t = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as DbRow | undefined;
    if (!t) return null;

    const base = mapTaskRow(t);

    const comments: KanbanComment[] = safeAll(
      db,
      "SELECT id, author, body, created_at FROM task_comments WHERE task_id = ? ORDER BY id",
      [id],
    ).map((c) => ({
      id: Number(c.id),
      author: c.author ? String(c.author) : undefined,
      body: String(c.body ?? ""),
      createdAt: ago(c.created_at) ?? "—",
    }));

    // task_links(parent_id, child_id): parents block this task; children depend on it.
    const parents: KanbanLinkRef[] = safeAll(
      db,
      `SELECT t.id, t.title, t.status FROM task_links l JOIN tasks t ON t.id = l.parent_id WHERE l.child_id = ?`,
      [id],
    ).map(toLinkRef);
    const children: KanbanLinkRef[] = safeAll(
      db,
      `SELECT t.id, t.title, t.status FROM task_links l JOIN tasks t ON t.id = l.child_id WHERE l.parent_id = ?`,
      [id],
    ).map(toLinkRef);

    const runs: KanbanRun[] = safeAll(
      db,
      `SELECT id, profile, step_key, status, outcome, summary, error, started_at, ended_at
       FROM task_runs WHERE task_id = ? ORDER BY id DESC LIMIT 20`,
      [id],
    ).map((r) => ({
      id: Number(r.id),
      profile: r.profile ? String(r.profile) : undefined,
      stepKey: r.step_key ? String(r.step_key) : undefined,
      status: r.status ? String(r.status) : undefined,
      outcome: r.outcome ? String(r.outcome) : undefined,
      summary: r.summary ? String(r.summary).replace(/\s+/g, " ").slice(0, 300) : undefined,
      error: r.error ? String(r.error).replace(/\s+/g, " ").slice(0, 300) : undefined,
      startedAt: ago(r.started_at),
      endedAt: ago(r.ended_at),
      duration: durationBetween(r.started_at, r.ended_at),
    }));

    const events: KanbanEvent[] = safeAll(
      db,
      `SELECT id, kind, run_id, payload, created_at FROM task_events WHERE task_id = ? ORDER BY id DESC LIMIT 30`,
      [id],
    ).map((e) => ({
      id: Number(e.id),
      kind: String(e.kind ?? "event"),
      runId: e.run_id != null ? Number(e.run_id) : undefined,
      summary: summarizePayload(e.payload),
      createdAt: ago(e.created_at) ?? "—",
    }));

    return {
      ...base,
      createdBy: t.created_by ? String(t.created_by) : undefined,
      workspacePath: t.workspace_path ? String(t.workspace_path) : undefined,
      result: t.result ? String(t.result) : undefined,
      lastFailureError: t.last_failure_error ? String(t.last_failure_error) : undefined,
      sessionId: t.session_id ? String(t.session_id) : undefined,
      modelOverride: t.model_override ? String(t.model_override) : undefined,
      currentStepKey: t.current_step_key ? String(t.current_step_key) : undefined,
      comments,
      parents,
      children,
      runs,
      events,
    };
  } finally {
    db.close();
  }
}

function toLinkRef(r: DbRow): KanbanLinkRef {
  return {
    id: String(r.id),
    title: String(r.title ?? "Untitled"),
    status: (VALID_STATUSES.includes(r.status as TaskStatus) ? r.status : "triage") as TaskStatus,
  };
}

/** Run a query that may reference a table the board doesn't have; [] on error. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeAll(db: any, sql: string, params: unknown[]): DbRow[] {
  try {
    return db.prepare(sql).all(...params) as DbRow[];
  } catch {
    return [];
  }
}
