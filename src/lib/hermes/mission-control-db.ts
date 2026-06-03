import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  HermesCrewActionKind,
  HermesCrewActionRecord,
  HermesCrewActivity,
  HermesCrewAffectedObjectKind,
  HermesCrewRole,
} from "../types.ts";

function resolveHermesHome(): string {
  return process.env.HERMES_HOME || path.join(os.homedir(), ".hermes");
}

function readActiveProfile(home = resolveHermesHome()): string | null {
  const fromEnv = process.env.HERMES_PROFILE?.trim();
  if (fromEnv) return fromEnv;
  try {
    const name = fs.readFileSync(path.join(home, "active_profile"), "utf-8").trim();
    return name || null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadSqlite(): any | null {
  try {
    const builtinLoader = (
      process as NodeJS.Process & {
        getBuiltinModule?: (id: string) => unknown;
      }
    ).getBuiltinModule;
    if (typeof builtinLoader === "function") return builtinLoader("node:sqlite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("node:sqlite");
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function openDb(dbPath: string, readOnly: boolean): any | null {
  try {
    const DatabaseSync = loadSqlite()?.DatabaseSync;
    if (!DatabaseSync) return null;
    return new DatabaseSync(dbPath, { readOnly });
  } catch {
    return null;
  }
}

export function missionControlDbPath(home = resolveHermesHome(), profile = readActiveProfile(home) ?? "default"): string {
  const base = profile == "default" ? home : path.join(home, "profiles", profile);
  return path.join(base, "mission-control", "activity.db");
}

function ensureParent(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      ts TEXT,
      profile TEXT,
      role TEXT,
      source TEXT NOT NULL,
      source_id TEXT,
      title TEXT NOT NULL,
      status TEXT,
      summary TEXT,
      metadata_json TEXT
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      ts TEXT,
      profile TEXT,
      role TEXT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      obsidian_path TEXT,
      task_id TEXT,
      channel_id TEXT,
      metadata_json TEXT
    );
    CREATE TABLE IF NOT EXISTS acks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      actor TEXT NOT NULL,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS operator_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      actor TEXT NOT NULL,
      profile TEXT,
      role TEXT,
      issue_id TEXT,
      request_id TEXT,
      action_kind TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      target_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      note TEXT,
      summary TEXT NOT NULL,
      detail TEXT
    );
  `);
}

type DbRow = Record<string, unknown>;

export function readMissionControlEvents(dbPath = missionControlDbPath()): HermesCrewActivity[] {
  if (!fs.existsSync(dbPath)) return [];
  const db = openDb(dbPath, true);
  if (!db) return [];
  try {
    const rows = db.prepare("SELECT * FROM events ORDER BY COALESCE(ts, '') DESC LIMIT 40").all() as DbRow[];
    return rows.map((row): HermesCrewActivity => ({
      id: String(row.id),
      ts: row.ts ? String(row.ts) : undefined,
      when: row.ts ? String(row.ts) : "—",
      profile: row.profile ? String(row.profile) : undefined,
      role: row.role ? (String(row.role) as HermesCrewActivity["role"]) : undefined,
      source: "mission-control",
      sourceId: row.source_id ? String(row.source_id) : undefined,
      title: String(row.title ?? "Mission-control event"),
      status: row.status ? String(row.status) : undefined,
      summary: row.summary ? String(row.summary) : undefined,
    }));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export function readMissionControlAcks(dbPath = missionControlDbPath()): Set<string> {
  if (!fs.existsSync(dbPath)) return new Set();
  const db = openDb(dbPath, true);
  if (!db) return new Set();
  try {
    const rows = db.prepare("SELECT DISTINCT event_id FROM acks").all() as DbRow[];
    return new Set(rows.map((row) => String(row.event_id)));
  } catch {
    return new Set();
  } finally {
    db.close();
  }
}

function relativeTime(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return iso;
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function readMissionControlActionHistory(dbPath = missionControlDbPath()): HermesCrewActionRecord[] {
  if (!fs.existsSync(dbPath)) return [];
  const db = openDb(dbPath, true);
  if (!db) return [];
  try {
    ensureSchema(db);
    const rows = db.prepare("SELECT * FROM operator_actions ORDER BY ts DESC, id DESC LIMIT 50").all() as DbRow[];
    return rows.map((row): HermesCrewActionRecord => {
      const ts = String(row.ts ?? new Date().toISOString());
      return {
        id: String(row.id),
        ts,
        when: relativeTime(ts),
        actor: String(row.actor ?? "agentic-os"),
        profile: row.profile ? String(row.profile) : undefined,
        role: row.role ? (String(row.role) as HermesCrewRole) : undefined,
        issueId: row.issue_id ? String(row.issue_id) : undefined,
        requestId: row.request_id ? String(row.request_id) : undefined,
        actionKind: String(row.action_kind) as HermesCrewActionKind,
        targetKind: String(row.target_kind) as HermesCrewAffectedObjectKind,
        targetId: String(row.target_id),
        outcome: String(row.outcome) === "failure" ? "failure" : "success",
        note: row.note ? String(row.note) : undefined,
        summary: String(row.summary ?? "Operator action"),
        detail: row.detail ? String(row.detail) : undefined,
      };
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export interface RecordMissionControlActionInput {
  actor?: string;
  profile?: string;
  role?: HermesCrewRole;
  issueId?: string;
  requestId?: string;
  actionKind: HermesCrewActionKind;
  targetKind: HermesCrewAffectedObjectKind;
  targetId: string;
  outcome: "success" | "failure";
  note?: string;
  summary: string;
  detail?: string;
}

export interface AckResult {
  ok: boolean;
  message: string;
}

export function crewActionsEnabled(): boolean {
  return /^(1|true)$/i.test(process.env.AGENTIC_ENABLE_HERMES_CREW_ACTIONS ?? "");
}

export function recordMissionControlAction(
  input: RecordMissionControlActionInput,
  dbPath = missionControlDbPath(),
): AckResult {
  ensureParent(dbPath);
  const db = openDb(dbPath, false);
  if (!db) return { ok: false, message: "node:sqlite is unavailable; run on Node 22+" };
  try {
    ensureSchema(db);
    db.prepare(
      `INSERT INTO operator_actions (
        ts, actor, profile, role, issue_id, request_id, action_kind, target_kind, target_id, outcome, note, summary, detail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      new Date().toISOString(),
      input.actor ?? "agentic-os",
      input.profile ?? null,
      input.role ?? null,
      input.issueId ?? null,
      input.requestId ?? null,
      input.actionKind,
      input.targetKind,
      input.targetId,
      input.outcome,
      input.note?.slice(0, 2000) ?? null,
      input.summary,
      input.detail?.slice(0, 8000) ?? null,
    );
    return { ok: true, message: "Operator action recorded" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to record operator action" };
  } finally {
    db.close();
  }
}

export function ackMissionControlEvent(
  eventId: string,
  note?: string,
  dbPath = missionControlDbPath(),
  actor = "agentic-os",
): AckResult {
  if (!crewActionsEnabled()) {
    return { ok: false, message: "Hermes crew actions are disabled" };
  }
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(eventId)) {
    return { ok: false, message: "Invalid event id" };
  }
  ensureParent(dbPath);
  const db = openDb(dbPath, false);
  if (!db) return { ok: false, message: "node:sqlite is unavailable; run on Node 22+" };
  try {
    ensureSchema(db);
    const ts = new Date().toISOString();
    db.exec("BEGIN");
    db.prepare("INSERT INTO acks (event_id, ts, actor, note) VALUES (?, ?, ?, ?)").run(
      eventId,
      ts,
      actor,
      note?.slice(0, 500) ?? null,
    );
    db.prepare(
      `INSERT INTO operator_actions (
        ts, actor, profile, role, issue_id, request_id, action_kind, target_kind, target_id, outcome, note, summary, detail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ts,
      actor,
      null,
      null,
      `event:${eventId}`,
      null,
      "ack_event",
      "event",
      eventId,
      "success",
      note?.slice(0, 2000) ?? null,
      "Acknowledged mission-control event",
      null,
    );
    db.exec("COMMIT");
    return { ok: true, message: "Event acknowledged" };
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // noop: rollback best-effort only
    }
    return { ok: false, message: err instanceof Error ? err.message : "Failed to acknowledge event" };
  } finally {
    db.close();
  }
}
