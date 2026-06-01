import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_CACHE_MS = 180_000;
const SESSION_SCAN_LIMIT = 40;

interface SessionIndexEntry {
  id: string;
  updated_at: string;
}

interface RawRateLimitWindow {
  used_percent?: number;
  window_minutes?: number;
  resets_at?: number;
  usedPercent?: number;
  windowDurationMins?: number;
  resetsAt?: number;
}

interface RawRateLimits {
  limit_id?: string | null;
  limit_name?: string | null;
  primary?: RawRateLimitWindow | null;
  secondary?: RawRateLimitWindow | null;
  credits?: unknown;
  plan_type?: string | null;
  rate_limit_reached_type?: string | null;
}

export interface CodexRateLimitWindow {
  pct: number;
  resetsAt: string | null;
  windowDurationMins: number | null;
}

export interface CodexRateLimitsCard {
  fiveHour: CodexRateLimitWindow | null;
  sevenDay: CodexRateLimitWindow | null;
  fetchedAt: string;
  updatedAt: string | null;
  source: "session";
  planType: string | null;
  rateLimitReachedType: string | null;
}

export class CodexRateLimitsError extends Error {
  readonly code: "NO_DATA" | "BAD_DATA" | "REQUEST_FAILED";

  constructor(message: string, code: "NO_DATA" | "BAD_DATA" | "REQUEST_FAILED") {
    super(message);
    this.name = "CodexRateLimitsError";
    this.code = code;
  }
}

type CacheEntry = { data: CodexRateLimitsCard; ts: number };
type SnapshotCandidate = {
  updatedAt: string | null;
  snapshot: RawRateLimits;
};

let cache: CacheEntry | null = null;
let inFlight: Promise<CodexRateLimitsCard> | null = null;

function runtimeConfig() {
  const home = process.env.CODEX_HOME?.trim() || path.join(homedir(), ".codex");
  const cacheMs = Number(process.env.CODEX_RATE_LIMITS_CACHE_MS ?? DEFAULT_CACHE_MS);
  return {
    codexHome: home,
    sessionIndexPath: path.join(home, "session_index.jsonl"),
    sessionsDir: path.join(home, "sessions"),
    cacheMs: Number.isFinite(cacheMs) && cacheMs > 0 ? cacheMs : DEFAULT_CACHE_MS,
  };
}

function findSessionFile(id: string, updatedAt: string, sessionsDir: string): string | null {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const dir = path.join(sessionsDir, String(yyyy), mm, dd);
  if (!fs.existsSync(dir)) return null;

  const file = fs.readdirSync(dir).find((entry) => entry.endsWith(`${id}.jsonl`));
  return file ? path.join(dir, file) : null;
}

function readIndexEntries(): SessionIndexEntry[] {
  const { sessionIndexPath } = runtimeConfig();
  if (!fs.existsSync(sessionIndexPath)) {
    throw new CodexRateLimitsError(
      `Could not read Codex session index at ${sessionIndexPath}. Is Codex being used on this machine?`,
      "NO_DATA",
    );
  }

  const lines = fs.readFileSync(sessionIndexPath, "utf-8").split("\n").filter((line) => line.trim());
  const entries: SessionIndexEntry[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as SessionIndexEntry;
      if (parsed.id && parsed.updated_at) entries.push(parsed);
    } catch {
      // skip malformed lines
    }
  }

  if (entries.length === 0) {
    throw new CodexRateLimitsError("Codex session index is present but contains no sessions.", "NO_DATA");
  }

  entries.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return entries;
}

function normalizeWindow(window: RawRateLimitWindow | null | undefined): CodexRateLimitWindow | null {
  if (!window) return null;
  const usedPercent = typeof window.used_percent === "number"
    ? window.used_percent
    : typeof window.usedPercent === "number"
      ? window.usedPercent
      : null;
  const windowMinutes = typeof window.window_minutes === "number"
    ? window.window_minutes
    : typeof window.windowDurationMins === "number"
      ? window.windowDurationMins
      : null;
  const resetsAtEpoch = typeof window.resets_at === "number"
    ? window.resets_at
    : typeof window.resetsAt === "number"
      ? window.resetsAt
      : null;

  if (usedPercent === null) return null;
  return {
    pct: Math.round(Math.max(0, Math.min(100, usedPercent)) * 10) / 10,
    resetsAt: resetsAtEpoch && resetsAtEpoch > 0 ? new Date(resetsAtEpoch * 1000).toISOString() : null,
    windowDurationMins: windowMinutes && windowMinutes > 0 ? windowMinutes : null,
  };
}

function snapshotIsUsable(snapshot: RawRateLimits): boolean {
  const primary = normalizeWindow(snapshot.primary);
  const secondary = normalizeWindow(snapshot.secondary);
  return Boolean(primary?.windowDurationMins && secondary?.windowDurationMins);
}

function extractLatestSnapshot(filePath: string): SnapshotCandidate | null {
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter((line) => line.trim());
  let latestAny: SnapshotCandidate | null = null;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]) as {
        timestamp?: string;
        type?: string;
        payload?: {
          type?: string;
          rate_limits?: RawRateLimits;
        };
      };
      if (
        parsed.type !== "event_msg" ||
        parsed.payload?.type !== "token_count" ||
        !parsed.payload.rate_limits
      ) {
        continue;
      }

      const candidate: SnapshotCandidate = {
        updatedAt: parsed.timestamp ?? null,
        snapshot: parsed.payload.rate_limits,
      };
      if (!latestAny) latestAny = candidate;
      if (snapshotIsUsable(candidate.snapshot)) return candidate;
    } catch {
      // skip malformed lines
    }
  }

  return latestAny;
}

function readLatestSnapshot(): SnapshotCandidate {
  const { sessionsDir } = runtimeConfig();
  const entries = readIndexEntries().slice(0, SESSION_SCAN_LIMIT);
  let fallback: SnapshotCandidate | null = null;

  for (const entry of entries) {
    const filePath = findSessionFile(entry.id, entry.updated_at, sessionsDir);
    if (!filePath) continue;

    try {
      const candidate = extractLatestSnapshot(filePath);
      if (!candidate) continue;
      if (!fallback) fallback = candidate;
      if (snapshotIsUsable(candidate.snapshot)) return candidate;
    } catch {
      // skip unreadable files
    }
  }

  if (fallback) return fallback;
  throw new CodexRateLimitsError("No Codex rate-limit snapshots were found in recent session files.", "NO_DATA");
}

function toCard(candidate: SnapshotCandidate): CodexRateLimitsCard {
  const primary = normalizeWindow(candidate.snapshot.primary);
  const secondary = normalizeWindow(candidate.snapshot.secondary);
  const windows = [primary, secondary].filter((window): window is CodexRateLimitWindow => Boolean(window));

  const fiveHour = windows.find((window) => window.windowDurationMins === 300) ?? primary;
  const sevenDay = windows.find((window) => window.windowDurationMins === 10_080) ?? secondary;

  return {
    fiveHour: fiveHour ?? null,
    sevenDay: sevenDay ?? null,
    fetchedAt: new Date().toISOString(),
    updatedAt: candidate.updatedAt,
    source: "session",
    planType: candidate.snapshot.plan_type ?? null,
    rateLimitReachedType: candidate.snapshot.rate_limit_reached_type ?? null,
  };
}

export async function getCodexRateLimits(
  opts: { force?: boolean } = {},
): Promise<CodexRateLimitsCard> {
  const { cacheMs } = runtimeConfig();
  if (!opts.force && cache && Date.now() - cache.ts < cacheMs) {
    return cache.data;
  }

  if (inFlight) return inFlight;

  inFlight = Promise.resolve().then(() => {
    const snapshot = readLatestSnapshot();
    const data = toCard(snapshot);
    if (!data.fiveHour && !data.sevenDay) {
      throw new CodexRateLimitsError("Codex rate-limit snapshots did not include usable 5h or 7d windows.", "BAD_DATA");
    }
    cache = { data, ts: Date.now() };
    return data;
  });

  try {
    return await inFlight;
  } catch (error) {
    if (error instanceof CodexRateLimitsError) throw error;
    throw new CodexRateLimitsError(
      error instanceof Error ? error.message : "Unknown Codex rate-limit error",
      "REQUEST_FAILED",
    );
  } finally {
    inFlight = null;
  }
}

export const __internal = {
  normalizeWindow,
  extractLatestSnapshot,
  runtimeConfig,
  resetCache() {
    cache = null;
    inFlight = null;
  },
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  getCodexRateLimits({ force: true })
    .then((usage) => {
      console.log(JSON.stringify(usage, null, 2));
      process.exit(0);
    })
    .catch((error: unknown) => {
      const message =
        error instanceof CodexRateLimitsError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Unknown error";
      console.error(message);
      process.exit(1);
    });
}
