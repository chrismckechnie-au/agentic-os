import "server-only";

import fs from "node:fs";
import path from "node:path";
import { readActiveProfile, resolveHermesHome } from "./paths";
import type { HermesCrewActivity } from "../types";

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
  const base = profile === "default" ? home : path.join(home, "profiles", profile);
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

export interface AckResult {
  ok: boolean;
  message: string;
}

export function crewActionsEnabled(): boolean {
  return /^(1|true)$/i.test(process.env.AGENTIC_ENABLE_HERMES_CREW_ACTIONS ?? "");
}

export function ackMissionControlEvent(eventId: string, note?: string): AckResult {
  if (!crewActionsEnabled()) {
    return { ok: false, message: "Hermes crew actions are disabled" };
  }
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(eventId)) {
    return { ok: false, message: "Invalid event id" };
  }
  const dbPath = missionControlDbPath();
  ensureParent(dbPath);
  const db = openDb(dbPath, false);
  if (!db) return { ok: false, message: "node:sqlite is unavailable; run on Node 22+" };
  try {
    ensureSchema(db);
    db.prepare("INSERT INTO acks (event_id, ts, actor, note) VALUES (?, ?, ?, ?)").run(
      eventId,
      new Date().toISOString(),
      "agentic-os",
      note?.slice(0, 500) ?? null,
    );
    return { ok: true, message: "Event acknowledged" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to acknowledge event" };
  } finally {
    db.close();
  }
}
