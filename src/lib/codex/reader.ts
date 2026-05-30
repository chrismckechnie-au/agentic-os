import fs from "fs";
import path from "path";
import os from "os";
import type { SessionDetail, SessionMessage } from "@/lib/types";
import { readThroughCache } from "@/lib/server/cache";

// Only usable in server components / API routes (Node.js runtime).

const CODEX_DIR = path.join(/* turbopackIgnore: true */ os.homedir(), ".codex");
const SESSION_INDEX = path.join(CODEX_DIR, "session_index.jsonl");
const SESSIONS_DIR = path.join(CODEX_DIR, "sessions");
const CACHE_TTL_MS = 30_000;

function relativeTime(ts: string): { label: string; group: string } {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60_000);
  const days = Math.floor(diff / 86_400_000);

  let label: string;
  if (min < 1) label = "just now";
  else if (min < 60) label = `${min}m ago`;
  else if (min < 1440) label = `${Math.floor(min / 60)}h ago`;
  else label = `${days}d ago`;

  let group: string;
  if (days === 0) group = "Today";
  else if (days === 1) group = "Yesterday";
  else if (days <= 7) group = "Previous 7 days";
  else group = "Earlier";

  return { label, group };
}

export interface CodexSession {
  id: string;
  agentId: "codex";
  title: string;
  workspace: string | null;
  cwd: string | null;
  status: "active" | "in_progress" | "completed";
  updatedAt: string;
  group: string;
  model: string | null;
  totalTokens: number;
  lastTimestamp: string;
  hitLimit: boolean;
}

export interface CodexUsage {
  available: boolean;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  sessions: number;
}

function findSessionFile(id: string, dateStr: string): string | null {
  // dateStr like "2026-05-29T07:05:18.960Z" → sessions/2026/05/29/rollout-*-{id}.jsonl
  const d = new Date(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const dir = path.join(SESSIONS_DIR, String(yyyy), mm, dd);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(id + ".jsonl"));
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

interface SessionIndexEntry {
  id: string;
  thread_name: string;
  updated_at: string;
}

function readIndexEntries(): SessionIndexEntry[] {
  if (!fs.existsSync(SESSION_INDEX)) return [];

  const stat = fs.statSync(SESSION_INDEX);
  return readThroughCache(
    "codex:session-index",
    CACHE_TTL_MS,
    () => {
      const lines = fs.readFileSync(SESSION_INDEX, "utf-8").split("\n").filter((l) => l.trim());
      const entries: SessionIndexEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.id && entry.thread_name && entry.updated_at) {
            entries.push(entry);
          }
        } catch {
          // skip malformed lines
        }
      }

      entries.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return entries;
    },
    `${stat.mtimeMs}:${stat.size}`,
  );
}

const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /usage.?limit/i,
  /too.?many.?requests/i,
  /overloaded_error/i,
  /\b529\b/,
  /usage.*policy/i,
  /quota.*exceeded/i,
];

function parseSessionFile(filePath: string): {
  cwd: string | null;
  model: string | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  hitLimit: boolean;
} {
  const result = { cwd: null as string | null, model: null as string | null, totalTokens: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, hitLimit: false };
  const lines = fs.readFileSync(filePath, { encoding: "utf-8", flag: "r" }).split("\n").filter((l) => l.trim());
  result.hitLimit = lines.slice(-20).some((l) => RATE_LIMIT_PATTERNS.some((re) => re.test(l)));

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === "session_meta") {
        if (msg.payload?.cwd) result.cwd = msg.payload.cwd;
        if (msg.payload?.model_provider) result.model = msg.payload.model_provider;
      }
      if (msg.type === "event_msg" && msg.payload?.type === "token_count") {
        const u = msg.payload.info?.total_token_usage;
        if (u) {
          result.totalTokens = u.total_tokens ?? 0;
          result.inputTokens = u.input_tokens ?? 0;
          result.outputTokens = u.output_tokens ?? 0;
          result.cachedTokens = u.cached_input_tokens ?? 0;
        }
      }
    } catch {
      // skip malformed lines
    }
  }
  return result;
}

function parseCachedSessionFile(filePath: string): ReturnType<typeof parseSessionFile> {
  const stat = fs.statSync(filePath);
  return readThroughCache(
    `codex:session-file:${filePath}`,
    CACHE_TTL_MS,
    () => parseSessionFile(filePath),
    `${stat.mtimeMs}:${stat.size}`,
  );
}

export function readSessions(limit = 50): CodexSession[] {
  const recent = readIndexEntries().slice(0, limit);

  return recent.map((e) => {
    const diff = Date.now() - new Date(e.updated_at).getTime();
    const diffMin = Math.floor(diff / 60_000);
    const status = diffMin < 5 ? "active" : diffMin < 60 ? "in_progress" : "completed";
    const { label, group } = relativeTime(e.updated_at);

    // Try to read cwd from session file (best-effort, skip if slow)
    let workspace: string | null = null;
    let cwd: string | null = null;
    let model: string | null = null;
    let hitLimit = false;
    let totalTokens = 0;
    try {
      const filePath = findSessionFile(e.id, e.updated_at);
      if (filePath) {
        const parsed = parseCachedSessionFile(filePath);
        cwd = parsed.cwd;
        workspace = parsed.cwd ? path.basename(parsed.cwd) : null;
        model = parsed.model;
        hitLimit = parsed.hitLimit;
        totalTokens = parsed.totalTokens;
      }
    } catch {
      // best-effort
    }

    return {
      id: e.id,
      agentId: "codex" as const,
      title: e.thread_name.replace(/[\r\n\t]+/g, " ").trim().slice(0, 100),
      workspace,
      cwd,
      status,
      updatedAt: label,
      group,
      model,
      totalTokens,
      lastTimestamp: e.updated_at,
      hitLimit,
    };
  });
}

function isInstructionNoise(text: string): boolean {
  const head = text.slice(0, 60);
  return (
    head.startsWith("# AGENTS.md") ||
    head.includes("<permissions instructions>") ||
    head.includes("<INSTRUCTIONS>") ||
    head.includes("<user_instructions>") ||
    head.includes("<environment_context>")
  );
}

function blocksToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as Array<Record<string, unknown>>)
    .map((b) => (typeof b.text === "string" ? b.text : ""))
    .join("")
    .trim();
}

function parseCodexTranscript(filePath: string, max = 150): SessionMessage[] {
  const lines = fs.readFileSync(filePath, { encoding: "utf-8" }).split("\n").filter((l) => l.trim());
  const msgs: SessionMessage[] = [];

  for (const line of lines) {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(line);
    } catch {
      continue;
    }
    if (m.type !== "response_item") continue;
    const payload = m.payload as { type?: string; role?: string; content?: unknown } | undefined;
    if (payload?.type !== "message") continue;
    const role = payload.role;
    if (role !== "user" && role !== "assistant") continue;

    const text = blocksToText(payload.content).replace(/\r/g, "").trim();
    if (!text) continue;
    if (role === "user" && isInstructionNoise(text)) continue;

    const ts = typeof m.timestamp === "string" ? m.timestamp : undefined;
    msgs.push({
      role: role === "user" ? "user" : "agent",
      kind: role === "user" ? "prompt" : "output",
      text,
      ts,
    });
  }

  return msgs.slice(-max);
}

export function readSessionDetail(id: string): SessionDetail | null {
  const entry = readIndexEntries().find((candidate) => candidate.id === id) ?? null;
  if (!entry) return null;

  const filePath = findSessionFile(id, entry.updated_at);
  if (!filePath) return null;

  const meta = parseCachedSessionFile(filePath);
  const transcript = parseCodexTranscript(filePath);

  const diff = Date.now() - new Date(entry.updated_at).getTime();
  const diffMin = Math.floor(diff / 60_000);
  const status = diffMin < 5 ? "active" : diffMin < 60 ? "in_progress" : "completed";
  const { label, group } = relativeTime(entry.updated_at);
  const workspace = meta.cwd ? path.basename(meta.cwd) : undefined;

  return {
    id,
    agentId: "codex",
    title: entry.thread_name.replace(/[\r\n\t]+/g, " ").trim().slice(0, 100),
    workspace,
    status,
    updatedAt: label,
    group,
    model: meta.model ?? undefined,
    transcript,
    tokensIn: meta.inputTokens,
    tokensOut: meta.outputTokens,
    totalTokens: meta.totalTokens,
    sandbox: meta.cwd ?? undefined,
  };
}

export function readUsage(days = 30): CodexUsage {
  const entries = readIndexEntries();
  if (entries.length === 0) {
    return { available: false, totalTokens: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, sessions: 0 };
  }

  const cutoff = Date.now() - days * 86_400_000;
  let totalTokens = 0, inputTokens = 0, outputTokens = 0, cachedTokens = 0, sessionCount = 0;

  for (const entry of entries) {
    try {
      if (new Date(entry.updated_at).getTime() < cutoff) continue;

      const filePath = findSessionFile(entry.id, entry.updated_at);
      if (!filePath) continue;

      const parsed = parseCachedSessionFile(filePath);
      if (parsed.totalTokens === 0) continue;
      totalTokens += parsed.totalTokens;
      inputTokens += parsed.inputTokens;
      outputTokens += parsed.outputTokens;
      cachedTokens += parsed.cachedTokens;
      sessionCount++;
    } catch {
      // skip
    }
  }

  return { available: true, totalTokens, inputTokens, outputTokens, cachedTokens, sessions: sessionCount };
}
