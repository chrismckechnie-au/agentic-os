import "server-only";

import fs from "node:fs";
import type { HermesSessionRow, Session, SessionDetail, SessionMessage } from "@/lib/types";
import { resolveStateDb } from "@/lib/hermes/paths";

export { resolveStateDb } from "@/lib/hermes/paths";

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

// Live reader for Hermes chat history. Reads ~/.hermes/state.db (the same store
// Hermes' own dashboard serves via hermes_state.SessionDB) directly through
// Node's built-in node:sqlite — no hermes process, no Python. Server-only.
//
//   sessions(id, source, model, title, started_at, ended_at, message_count,
//            input_tokens, output_tokens, …)
//   messages(id, session_id, role, content, tool_name, timestamp, …)

export function stateDbExists(dbPath = resolveStateDb()): boolean {
  try {
    return fs.statSync(dbPath).isFile();
  } catch {
    return false;
  }
}

export function getStateDbHealth(dbPath = resolveStateDb()): {
  available: boolean;
  readable: boolean;
  dbPath: string;
  reason?: string;
} {
  if (!stateDbExists(dbPath)) {
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

/** ISO / epoch (s or ms) -> "just now" / "12m ago" / "3h ago" / "2d ago". */
function ago(value: unknown): string | undefined {
  const ms = toMs(value);
  if (ms == null) return undefined;
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

function groupOf(value: unknown): string {
  const ms = toMs(value);
  if (ms == null) return "Earlier";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Previous 7 days";
  return "Earlier";
}

/** Coerce an epoch (seconds or ms) or ISO string to ms, or null. */
function toMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value < 1e12 ? value * 1000 : value;
  }
  const t = new Date(String(value)).getTime();
  return Number.isFinite(t) ? t : null;
}

type DbRow = Record<string, unknown>;

function isRecent(endedAt: unknown, startedAt: unknown): boolean {
  if (endedAt != null) return false;
  const ms = toMs(startedAt);
  if (ms == null) return false;
  return Date.now() - ms < 5 * 60_000;
}

/**
 * First meaningful paragraph of a prompt, skipping a leading system/cron
 * preamble (e.g. the "[IMPORTANT: You are running as a scheduled cron job…]"
 * block that ~all cron prompts share) so derived titles are distinct.
 */
function firstMeaningfulLine(raw: string): string {
  const paras = raw
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return paras.find((p) => !/^\[IMPORTANT\b/i.test(p)) ?? paras[0] ?? "";
}

function titleOf(row: DbRow): string {
  const t = row.title ? String(row.title).trim() : "";
  if (t) return t.replace(/[\r\n\t]+/g, " ").slice(0, 100);
  const snippet = row.first_user ? firstMeaningfulLine(String(row.first_user)) : "";
  if (snippet) return snippet.slice(0, 80);
  return `Conversation ${String(row.id).slice(0, 12)}`;
}

/** Build a safe FTS5 prefix query from free text (tokens AND-ed, prefix-matched). */
function ftsQuery(raw: string): string | null {
  const tokens = raw.match(/[a-z0-9_]+/gi);
  if (!tokens || tokens.length === 0) return null;
  return tokens.slice(0, 8).map((t) => `${t}*`).join(" ");
}

/** Find the most recent descendant of a session chain (parent_session_id). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function descendantTip(db: any, id: string): string {
  try {
    const row = db
      .prepare(
        `WITH RECURSIVE d(id, started_at) AS (
           SELECT id, started_at FROM sessions WHERE parent_session_id = ?
           UNION ALL
           SELECT s.id, s.started_at FROM sessions s JOIN d ON s.parent_session_id = d.id
         )
         SELECT id FROM d ORDER BY started_at DESC LIMIT 1`,
      )
      .get(id) as DbRow | undefined;
    return row?.id ? String(row.id) : id;
  } catch {
    return id;
  }
}

// --- public API -------------------------------------------------------------

/** Most recent descendant of a session, or the id itself when it has no children. */
export function latestDescendant(id: string, dbPath = resolveStateDb()): string {
  const db = tryOpenDb(dbPath);
  if (!db) return id;
  try {
    return descendantTip(db, id);
  } finally {
    db.close();
  }
}

/**
 * Rich session rows for the Sessions tab: source/model/counts, optional FTS
 * search over message bodies, and offset pagination. `total` is the size of the
 * (optionally filtered) result set so the UI can paginate.
 */
export function readSessionRows(
  opts: { limit?: number; offset?: number; query?: string } = {},
  dbPath = resolveStateDb(),
): { rows: HermesSessionRow[]; total: number } {
  const limit = Math.min(Math.max(opts.limit ?? 40, 1), 200);
  const offset = Math.max(0, opts.offset ?? 0);
  const query = opts.query?.trim();

  const db = tryOpenDb(dbPath);
  if (!db) return { rows: [], total: 0 };
  try {
    let where = "";
    const filterParams: string[] = [];
    let total: number;

    if (query) {
      const match = ftsQuery(query);
      let ids: string[] = [];
      if (match) {
        try {
          ids = (
            db
              .prepare(
                `SELECT DISTINCT session_id AS sid FROM messages
                 WHERE id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)`,
              )
              .all(match) as DbRow[]
          ).map((r) => String(r.sid));
        } catch {
          ids = [];
        }
      }
      if (ids.length === 0) return { rows: [], total: 0 };
      // SQLite caps bound variables; cap the IN list and report a bounded total.
      const capped = ids.slice(0, 900);
      where = `WHERE s.id IN (${capped.map(() => "?").join(",")})`;
      filterParams.push(...capped);
      total = capped.length;
    } else {
      total = Number((db.prepare("SELECT COUNT(*) AS n FROM sessions").get() as DbRow).n ?? 0);
    }

    const rows = db
      .prepare(
        `SELECT s.id, s.source, s.model, s.title, s.parent_session_id,
                s.started_at, s.ended_at, s.message_count, s.tool_call_count,
                (SELECT m.content FROM messages m
                   WHERE m.session_id = s.id AND m.role = 'user'
                     AND m.content IS NOT NULL AND length(trim(m.content)) > 0
                   ORDER BY m.id LIMIT 1) AS first_user
         FROM sessions s
         ${where}
         ORDER BY s.started_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...filterParams, limit, offset) as DbRow[];

    return { rows: rows.map(toSessionRow), total };
  } finally {
    db.close();
  }
}

function toSessionRow(r: DbRow): HermesSessionRow {
  const when = r.ended_at ?? r.started_at;
  return {
    id: String(r.id),
    agentId: "hermes",
    title: titleOf(r),
    workspace: r.source ? String(r.source) : undefined,
    source: r.source ? String(r.source) : undefined,
    model: r.model ? String(r.model) : undefined,
    parentId: r.parent_session_id ? String(r.parent_session_id) : undefined,
    messageCount: Number(r.message_count ?? 0) || 0,
    toolCallCount: Number(r.tool_call_count ?? 0) || 0,
    status: isRecent(r.ended_at, r.started_at) ? "active" : "completed",
    updatedAt: ago(when) ?? "—",
    group: groupOf(when),
  };
}

export function readSessions(limit = 100, dbPath = resolveStateDb()): Session[] {
  const db = tryOpenDb(dbPath);
  if (!db) return [];
  try {
    const rows = db
      .prepare(
        `SELECT id, source, model, title, started_at, ended_at,
                message_count, input_tokens, output_tokens
         FROM sessions
         ORDER BY started_at DESC
         LIMIT ?`,
      )
      .all(limit) as DbRow[];

    return rows.map((r): Session => {
      const when = r.ended_at ?? r.started_at;
      return {
        id: String(r.id),
        agentId: "hermes",
        title: titleOf(r),
        workspace: r.source ? String(r.source) : undefined,
        status: isRecent(r.ended_at, r.started_at) ? "active" : "completed",
        updatedAt: ago(when) ?? "—",
        group: groupOf(when),
      };
    });
  } finally {
    db.close();
  }
}

function mapMessage(r: DbRow): SessionMessage | null {
  const role = String(r.role ?? "").toLowerCase();
  const content = r.content == null ? "" : String(r.content).trim();
  if (!content) return null;
  const ts = r.timestamp != null ? String(r.timestamp) : undefined;
  if (role === "user") return { role: "user", kind: "prompt", text: content, ts };
  if (role === "assistant") return { role: "agent", kind: "output", text: content, ts };
  if (role === "tool") {
    const name = r.tool_name ? `${String(r.tool_name)}: ` : "";
    return { role: "system", kind: "step", text: `${name}${content}`.slice(0, 2000), ts };
  }
  return null; // skip system / unknown
}

export function readSessionDetail(id: string, dbPath = resolveStateDb()): SessionDetail | null {
  const db = tryOpenDb(dbPath);
  if (!db) return null;
  try {
    const row = db
      .prepare(
        `SELECT id, source, model, title, started_at, ended_at,
                message_count, input_tokens, output_tokens,
                (SELECT m.content FROM messages m
                   WHERE m.session_id = sessions.id AND m.role = 'user'
                     AND m.content IS NOT NULL AND length(trim(m.content)) > 0
                   ORDER BY m.id LIMIT 1) AS first_user
         FROM sessions WHERE id = ?`,
      )
      .get(id) as DbRow | undefined;
    if (!row) return null;

    const msgRows = db
      .prepare(`SELECT role, content, tool_name, timestamp FROM messages WHERE session_id = ? ORDER BY id`)
      .all(id) as DbRow[];

    const transcript = msgRows
      .map(mapMessage)
      .filter((m): m is SessionMessage => m !== null)
      .slice(-200);

    const when = row.ended_at ?? row.started_at;
    const tokensIn = Number(row.input_tokens ?? 0) || undefined;
    const tokensOut = Number(row.output_tokens ?? 0) || undefined;

    return {
      id: String(row.id),
      agentId: "hermes",
      title: titleOf(row),
      workspace: row.source ? String(row.source) : undefined,
      status: isRecent(row.ended_at, row.started_at) ? "active" : "completed",
      updatedAt: ago(when) ?? "—",
      group: groupOf(when),
      model: row.model ? String(row.model) : undefined,
      startedAt: ago(row.started_at),
      transcript,
      tokensIn,
      tokensOut,
      totalTokens: (tokensIn ?? 0) + (tokensOut ?? 0) || undefined,
      resumeId: descendantTip(db, String(row.id)),
    };
  } finally {
    db.close();
  }
}
