import fs from "fs";
import path from "path";
import os from "os";
import type { SessionDetail, SessionMessage } from "@/lib/types";

// Only usable in server components / API routes (Node.js runtime).

const CLAUDE_DIR = path.join(os.homedir(), ".claude", "projects");

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

export interface ClaudeSession {
  id: string;
  agentId: "claude-code";
  title: string;
  workspace: string;
  status: "active" | "in_progress" | "completed";
  updatedAt: string;
  group: string;
  model: string | null;
  gitBranch: string | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  lastTimestamp: string;
  hitLimit: boolean;
}

export interface ClaudeUsage {
  available: boolean;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  sessions: number;
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

function hasRateLimitSignal(lines: string[]): boolean {
  // Check last 20 lines for error/system messages containing limit signals
  const tail = lines.slice(-20);
  for (const line of tail) {
    if (RATE_LIMIT_PATTERNS.some((re) => re.test(line))) return true;
  }
  return false;
}

// Read only the head and tail of a JSONL file — avoids loading multi-MB session files
// for simple metadata. Head covers firstUserMsg/cwd/firstTimestamp; tail covers
// lastTimestamp and rate-limit signals.
function readHeadTail(filePath: string, headBytes = 8192, tailBytes = 4096): string[] {
  const fd = fs.openSync(filePath, "r");
  try {
    const { size } = fs.fstatSync(fd);
    const readSize = Math.min(size, headBytes + tailBytes);
    const buf = Buffer.allocUnsafe(readSize);
    let bytesRead = 0;
    // head
    const headRead = Math.min(headBytes, size);
    bytesRead = fs.readSync(fd, buf, 0, headRead, 0);
    // tail (only if file is larger than head)
    if (size > headBytes) {
      const tailStart = Math.max(headBytes, size - tailBytes);
      const tailRead = size - tailStart;
      bytesRead += fs.readSync(fd, buf, headRead, tailRead, tailStart);
    }
    return buf.slice(0, bytesRead).toString("utf-8").split("\n").filter((l) => l.trim());
  } finally {
    fs.closeSync(fd);
  }
}

function parseJsonlFile(filePath: string, metaOnly = false): {
  firstUserMsg: string | null;
  lastTimestamp: string | null;
  firstTimestamp: string | null;
  cwd: string | null;
  gitBranch: string | null;
  model: string | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  hitLimit: boolean;
} {
  const result = {
    firstUserMsg: null as string | null,
    lastTimestamp: null as string | null,
    firstTimestamp: null as string | null,
    cwd: null as string | null,
    gitBranch: null as string | null,
    model: null as string | null,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheTokens: 0,
    hitLimit: false,
  };

  // For session list metadata, only read head+tail to avoid loading MB-sized files.
  const lines = metaOnly
    ? readHeadTail(filePath)
    : fs.readFileSync(filePath, "utf-8").split("\n").filter((l) => l.trim());

  result.hitLimit = hasRateLimitSignal(lines);

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);

      if (!result.firstTimestamp && msg.timestamp) result.firstTimestamp = msg.timestamp;
      if (msg.timestamp) result.lastTimestamp = msg.timestamp;
      if (msg.cwd && !result.cwd) result.cwd = msg.cwd;
      if (msg.gitBranch && msg.gitBranch !== "HEAD") result.gitBranch = msg.gitBranch;

      if (msg.type === "user" && !result.firstUserMsg && msg.message?.content) {
        const raw = msg.message.content;
        const text = typeof raw === "string" ? raw : (raw?.[0]?.text ?? "");
        result.firstUserMsg = text.replace(/[\r\n\t]+/g, " ").trim().slice(0, 100);
      }

      if (!metaOnly && msg.type === "assistant" && msg.message?.usage) {
        const u = msg.message.usage;
        const inp = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
        const cache = u.cache_read_input_tokens ?? 0;
        const out = u.output_tokens ?? 0;
        result.inputTokens += inp;
        result.outputTokens += out;
        result.cacheTokens += cache;
        result.totalTokens += inp + out + cache;
        if (msg.message.model) result.model = msg.message.model;
      }
    } catch {
      // skip malformed lines
    }
  }

  return result;
}

// Module-level cache: avoids re-scanning on every request within the same process.
let _sessionCache: { ts: number; sessions: ClaudeSession[] } | null = null;
const SESSION_CACHE_TTL = 30_000; // 30 s

function collectJsonlFiles(): { filePath: string; projectDir: string; mtime: number }[] {
  const out: { filePath: string; projectDir: string; mtime: number }[] = [];
  let projectDirs: string[];
  try {
    projectDirs = fs.readdirSync(CLAUDE_DIR).filter((f) => {
      try { return fs.statSync(path.join(CLAUDE_DIR, f)).isDirectory(); } catch { return false; }
    });
  } catch {
    return out;
  }
  for (const projectDir of projectDirs) {
    const projectPath = path.join(CLAUDE_DIR, projectDir);
    try {
      const files = fs.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl"));
      for (const f of files) {
        const fp = path.join(projectPath, f);
        try { out.push({ filePath: fp, projectDir, mtime: fs.statSync(fp).mtimeMs }); } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return out;
}

export function readSessions(limit = 50): ClaudeSession[] {
  if (!fs.existsSync(CLAUDE_DIR)) return [];

  const now = Date.now();
  if (_sessionCache && now - _sessionCache.ts < SESSION_CACHE_TTL) {
    return _sessionCache.sessions.slice(0, limit);
  }

  // Pre-sort by mtime so we only parse the N most-recently-modified files.
  const FETCH = Math.max(limit * 2, 200);
  const candidates = collectJsonlFiles()
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, FETCH);

  const sessions: ClaudeSession[] = [];

  for (const { filePath, projectDir } of candidates) {
    const sessionId = path.basename(filePath, ".jsonl");
    try {
      const parsed = parseJsonlFile(filePath, true); // metaOnly: head+tail read, skip token counts
      if (!parsed.firstUserMsg || !parsed.lastTimestamp) continue;

      const diff = now - new Date(parsed.lastTimestamp).getTime();
      const diffMin = Math.floor(diff / 60_000);
      const status =
        diffMin < 5 ? "active" : diffMin < 60 ? "in_progress" : "completed";

      const { label, group } = relativeTime(parsed.lastTimestamp);
      const workspace = parsed.cwd ? path.basename(parsed.cwd) : projectDir;

      sessions.push({
        id: sessionId,
        agentId: "claude-code",
        title: parsed.firstUserMsg,
        workspace,
        status,
        updatedAt: label,
        group,
        model: parsed.model,
        gitBranch: parsed.gitBranch,
        totalTokens: parsed.totalTokens,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        cacheTokens: parsed.cacheTokens,
        lastTimestamp: parsed.lastTimestamp,
        hitLimit: parsed.hitLimit,
      });
    } catch {
      // skip unreadable files
    }
  }

  const sorted = sessions.sort(
    (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime(),
  );
  _sessionCache = { ts: now, sessions: sorted };
  return sorted.slice(0, limit);
}

function shortToolInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const o = input as Record<string, unknown>;
  // Common Claude tool inputs: command, file_path, pattern, path, prompt, url
  const v = o.command ?? o.file_path ?? o.pattern ?? o.path ?? o.url ?? o.prompt ?? o.description;
  if (typeof v === "string") return v.replace(/[\r\n\t]+/g, " ").slice(0, 80);
  return "";
}

function parseTranscript(lines: string[], max = 150): SessionMessage[] {
  const msgs: SessionMessage[] = [];

  for (const line of lines) {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(line);
    } catch {
      continue;
    }

    const type = m.type;
    const message = m.message as { content?: unknown } | undefined;
    const ts = typeof m.timestamp === "string" ? m.timestamp : undefined;
    if ((type !== "user" && type !== "assistant") || !message?.content) continue;

    const content = message.content;

    if (typeof content === "string") {
      const text = content.replace(/\r/g, "").trim();
      if (text) msgs.push({ role: type === "user" ? "user" : "agent", kind: type === "user" ? "prompt" : "output", text, ts });
      continue;
    }

    if (!Array.isArray(content)) continue;

    for (const block of content as Array<Record<string, unknown>>) {
      const bt = block.type;
      if (bt === "text" && typeof block.text === "string") {
        const text = block.text.replace(/\r/g, "").trim();
        if (text) msgs.push({ role: type === "user" ? "user" : "agent", kind: type === "user" ? "prompt" : "output", text, ts });
      } else if (bt === "tool_use") {
        const name = typeof block.name === "string" ? block.name : "tool";
        const arg = shortToolInput(block.input);
        msgs.push({ role: "agent", kind: "step", text: arg ? `${name}(${arg})` : name, ts });
      }
      // skip thinking, tool_result, image, and other noise
    }
  }

  return msgs.slice(-max);
}

export function readSessionDetail(id: string): SessionDetail | null {
  if (!fs.existsSync(CLAUDE_DIR)) return null;

  const projectDirs = fs
    .readdirSync(CLAUDE_DIR)
    .filter((f) => {
      try {
        return fs.statSync(path.join(CLAUDE_DIR, f)).isDirectory();
      } catch {
        return false;
      }
    });

  let filePath: string | null = null;
  for (const projectDir of projectDirs) {
    const candidate = path.join(CLAUDE_DIR, projectDir, `${id}.jsonl`);
    if (fs.existsSync(candidate)) {
      filePath = candidate;
      break;
    }
  }
  if (!filePath) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  const meta = parseJsonlFile(filePath);
  const transcript = parseTranscript(lines);
  if (!meta.lastTimestamp) return null;

  const diff = Date.now() - new Date(meta.lastTimestamp).getTime();
  const diffMin = Math.floor(diff / 60_000);
  const status = diffMin < 5 ? "active" : diffMin < 60 ? "in_progress" : "completed";
  const { label, group } = relativeTime(meta.lastTimestamp);
  const workspace = meta.cwd ? path.basename(meta.cwd) : undefined;

  return {
    id,
    agentId: "claude-code",
    title: meta.firstUserMsg ?? "Untitled session",
    workspace,
    status,
    updatedAt: label,
    group,
    branch: meta.gitBranch ?? undefined,
    model: meta.model ?? undefined,
    startedAt: meta.firstTimestamp ?? undefined,
    transcript,
    tokensIn: meta.inputTokens,
    tokensOut: meta.outputTokens,
    totalTokens: meta.totalTokens,
  };
}

export function readUsage(days = 30): ClaudeUsage {
  if (!fs.existsSync(CLAUDE_DIR)) {
    return { available: false, totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, sessions: 0 };
  }

  const cutoff = Date.now() - days * 86_400_000;
  let totalTokens = 0, inputTokens = 0, outputTokens = 0, cacheTokens = 0, sessionCount = 0;

  const projectDirs = fs
    .readdirSync(CLAUDE_DIR)
    .filter((f) => fs.statSync(path.join(CLAUDE_DIR, f)).isDirectory());

  for (const projectDir of projectDirs) {
    const projectPath = path.join(CLAUDE_DIR, projectDir);
    const jsonlFiles = fs.readdirSync(projectPath).filter((f) => f.endsWith(".jsonl"));

    for (const jsonlFile of jsonlFiles) {
      const filePath = path.join(projectPath, jsonlFile);
      if (fs.statSync(filePath).mtimeMs < cutoff) continue;

      try {
        const parsed = parseJsonlFile(filePath);
        if (parsed.totalTokens === 0) continue;
        totalTokens += parsed.totalTokens;
        inputTokens += parsed.inputTokens;
        outputTokens += parsed.outputTokens;
        cacheTokens += parsed.cacheTokens;
        sessionCount++;
      } catch {
        // skip
      }
    }
  }

  return { available: true, totalTokens, inputTokens, outputTokens, cacheTokens, sessions: sessionCount };
}
