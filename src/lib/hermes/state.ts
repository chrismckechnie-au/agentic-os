import "server-only";

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { Session, SessionDetail, SessionMessage } from "@/lib/types";

// Live reader for Hermes chat history. Reads ~/.hermes/state.db (the same store
// Hermes' own dashboard serves via hermes_state.SessionDB) directly through
// Node's built-in node:sqlite — no hermes process, no Python. Server-only.
//
//   sessions(id, source, model, title, started_at, ended_at, message_count,
//            input_tokens, output_tokens, …)
//   messages(id, session_id, role, content, tool_name, timestamp, …)

/** Resolve the state.db path: $HERMES_STATE_DB or $HERMES_HOME/state.db or ~/.hermes/state.db. */
export function resolveStateDb(): string {
  if (process.env.HERMES_STATE_DB) return process.env.HERMES_STATE_DB;
  const home = process.env.HERMES_HOME || path.join(os.homedir(), ".hermes");
  return path.join(home, "state.db");
}

export function stateDbExists(dbPath = resolveStateDb()): boolean {
  try {
    return fs.statSync(dbPath).isFile();
  } catch {
    return false;
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

function titleOf(row: DbRow): string {
  const t = row.title ? String(row.title).trim() : "";
  if (t) return t.replace(/[\r\n\t]+/g, " ").slice(0, 100);
  return `Conversation ${String(row.id).slice(0, 8)}`;
}

// --- public API -------------------------------------------------------------

export function readSessions(limit = 100, dbPath = resolveStateDb()): Session[] {
  const db = new DatabaseSync(dbPath, { readOnly: true });
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
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const row = db
      .prepare(
        `SELECT id, source, model, title, started_at, ended_at,
                message_count, input_tokens, output_tokens
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
    };
  } finally {
    db.close();
  }
}
