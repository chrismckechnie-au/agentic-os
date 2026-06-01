import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_CACHE_MS = 180_000;
const SESSION_SCAN_LIMIT = 120;

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
  fileMtimeMs: number;
};

let cache: CacheEntry | null = null;
let inFlight: Promise<CodexRateLimitsCard> | null = null;

function runtimeConfig() {
  const home = process.env.CODEX_HOME?.trim() || path.join(homedir(), ".codex");
  const cacheMs = Number(process.env.CODEX_RATE_LIMITS_CACHE_MS ?? DEFAULT_CACHE_MS);
  return {
    codexHome: home,
    sessionsDir: path.join(home, "sessions"),
    cacheMs: Number.isFinite(cacheMs) && cacheMs > 0 ? cacheMs : DEFAULT_CACHE_MS,
  };
}

function listRecentSessionFiles(sessionsDir: string): string[] {
  if (!fs.existsSync(sessionsDir)) {
    throw new CodexRateLimitsError(
      `Could not read Codex session files at ${sessionsDir}. Is Codex being used on this machine?`,
      "NO_DATA",
    );
  }

  const pendingDirs = [sessionsDir];
  const files: Array<{ filePath: string; mtimeMs: number }> = [];

  while (pendingDirs.length > 0) {
    const dir = pendingDirs.pop();
    if (!dir) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        pendingDirs.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;

      try {
        files.push({
          filePath: fullPath,
          mtimeMs: fs.statSync(fullPath).mtimeMs,
        });
      } catch {
        // skip unreadable files
      }
    }
  }

  if (files.length === 0) {
    throw new CodexRateLimitsError("No Codex session files were found on this machine.", "NO_DATA");
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files.slice(0, SESSION_SCAN_LIMIT).map((entry) => entry.filePath);
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
  const fileMtimeMs = fs.statSync(filePath).mtimeMs;

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
        fileMtimeMs,
      };
      if (!latestAny) latestAny = candidate;
      if (snapshotIsUsable(candidate.snapshot)) return candidate;
    } catch {
      // skip malformed lines
    }
  }

  return latestAny;
}

function candidateSortTime(candidate: SnapshotCandidate): number {
  const updatedAtMs = candidate.updatedAt ? new Date(candidate.updatedAt).getTime() : Number.NaN;
  return Number.isFinite(updatedAtMs) ? updatedAtMs : candidate.fileMtimeMs;
}

function readLatestSnapshot(): SnapshotCandidate {
  const { sessionsDir } = runtimeConfig();
  const files = listRecentSessionFiles(sessionsDir);
  let latestUsable: SnapshotCandidate | null = null;
  let latestAny: SnapshotCandidate | null = null;

  for (const filePath of files) {
    try {
      const candidate = extractLatestSnapshot(filePath);
      if (!candidate) continue;
      if (!latestAny || candidateSortTime(candidate) > candidateSortTime(latestAny)) {
        latestAny = candidate;
      }
      if (
        snapshotIsUsable(candidate.snapshot) &&
        (!latestUsable || candidateSortTime(candidate) > candidateSortTime(latestUsable))
      ) {
        latestUsable = candidate;
      }
    } catch {
      // skip unreadable files
    }
  }

  if (latestUsable) return latestUsable;
  if (latestAny) return latestAny;
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
  listRecentSessionFiles,
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
