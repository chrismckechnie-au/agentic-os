import { readFile, writeFile, rename, chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const OAUTH_BETA = "oauth-2025-04-20";
const EXPIRY_SKEW_MS = 60_000;

interface StoredCredentials {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scopes?: string[];
  };
  [key: string]: unknown;
}

interface RawWindow {
  utilization: number;
  resets_at: string;
}

interface RawUsage {
  five_hour: RawWindow | null;
  seven_day: RawWindow | null;
  seven_day_opus: RawWindow | null;
  seven_day_sonnet: RawWindow | null;
  extra_usage?: unknown;
}

export interface UsageCardWindow {
  pct: number;
  resetsAt: string | null;
}

export interface UsageCard {
  fiveHour: UsageCardWindow | null;
  sevenDay: UsageCardWindow | null;
  sevenDayOpus: UsageCardWindow | null;
  sevenDaySonnet: UsageCardWindow | null;
  fetchedAt: string;
}

export class ClaudeUsageError extends Error {
  readonly code:
    | "NO_CREDENTIALS"
    | "BAD_CREDENTIALS"
    | "UNAUTHORIZED"
    | "RATE_LIMITED"
    | "REFRESH_FAILED"
    | "REQUEST_FAILED";

  constructor(
    message: string,
    code:
      | "NO_CREDENTIALS"
      | "BAD_CREDENTIALS"
      | "UNAUTHORIZED"
      | "RATE_LIMITED"
      | "REFRESH_FAILED"
      | "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "ClaudeUsageError";
    this.code = code;
  }
}

type CacheEntry = { data: UsageCard; ts: number };

let cache: CacheEntry | null = null;
let inFlight: Promise<UsageCard> | null = null;

function runtimeConfig() {
  const cacheMs = Number(process.env.CLAUDE_USAGE_CACHE_MS ?? 180_000);
  return {
    credentialsPath:
      process.env.CLAUDE_CREDENTIALS_PATH ??
      join(homedir(), ".claude", ".credentials.json"),
    userAgent: process.env.CLAUDE_USAGE_UA ?? "claude-code/2.1.159",
    cacheMs: Number.isFinite(cacheMs) && cacheMs > 0 ? cacheMs : 180_000,
  };
}

async function readCredentials(): Promise<StoredCredentials> {
  const path = runtimeConfig().credentialsPath;
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new ClaudeUsageError(
      `Could not read Claude credentials at ${path}. Is Claude Code logged in on this machine? ` +
        `Set CLAUDE_CREDENTIALS_PATH if the file lives elsewhere. ` +
        `(Note: on macOS the token may be in the Keychain instead of a file.)`,
      "NO_CREDENTIALS",
    );
  }

  let parsed: StoredCredentials;
  try {
    parsed = JSON.parse(raw) as StoredCredentials;
  } catch {
    throw new ClaudeUsageError(`Credentials file at ${path} is not valid JSON.`, "BAD_CREDENTIALS");
  }

  if (!parsed?.claudeAiOauth?.accessToken) {
    throw new ClaudeUsageError(
      `Credentials file at ${path} has no claudeAiOauth.accessToken.`,
      "BAD_CREDENTIALS",
    );
  }

  return parsed;
}

async function writeCredentials(creds: StoredCredentials): Promise<void> {
  const path = runtimeConfig().credentialsPath;
  await mkdir(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.credentials.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, path);
}

async function refreshToken(creds: StoredCredentials): Promise<StoredCredentials> {
  const { refreshToken, scopes } = creds.claudeAiOauth;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": runtimeConfig().userAgent,
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      ...(scopes?.length ? { scope: scopes.join(" ") } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new ClaudeUsageError(
        `Claude OAuth refresh is rate limited (${res.status}). The dashboard will retry automatically. ${body}`,
        "RATE_LIMITED",
      );
    }
    throw new ClaudeUsageError(
      `Token refresh failed (${res.status}). Re-authenticate by running \`claude\` on this machine. ${body}`,
      "REFRESH_FAILED",
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const updated: StoredCredentials = {
    ...creds,
    claudeAiOauth: {
      ...creds.claudeAiOauth,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    },
  };

  await writeCredentials(updated);
  return updated;
}

async function ensureFreshToken(
  opts: { allowStaleOnRateLimit?: boolean } = {},
): Promise<string> {
  let creds = await readCredentials();
  if (creds.claudeAiOauth.expiresAt - EXPIRY_SKEW_MS <= Date.now()) {
    try {
      creds = await refreshToken(creds);
    } catch (error) {
      if (
        opts.allowStaleOnRateLimit &&
        error instanceof ClaudeUsageError &&
        error.code === "RATE_LIMITED"
      ) {
        return creds.claudeAiOauth.accessToken;
      }
      throw error;
    }
  }
  return creds.claudeAiOauth.accessToken;
}

function usageHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "anthropic-beta": OAUTH_BETA,
    "User-Agent": runtimeConfig().userAgent,
    "Content-Type": "application/json",
  };
}

function toCardWindow(window: RawWindow | null): UsageCardWindow | null {
  if (!window) return null;
  return {
    pct: Math.round(window.utilization * 10) / 10,
    resetsAt: window.resets_at ?? null,
  };
}

async function fetchRawUsage(): Promise<RawUsage> {
  let token = await ensureFreshToken({ allowStaleOnRateLimit: true });

  const doGet = async (accessToken: string) =>
    fetch(USAGE_URL, { method: "GET", headers: usageHeaders(accessToken) });

  let res = await doGet(token);

  if (res.status === 401) {
    const creds = await refreshToken(await readCredentials());
    token = creds.claudeAiOauth.accessToken;
    res = await doGet(token);
  }

  if (res.status === 401) {
    throw new ClaudeUsageError(
      "Unauthorized even after refresh. Run `claude` on this machine to re-login.",
      "UNAUTHORIZED",
    );
  }

  if (res.status === 429) {
    throw new ClaudeUsageError(
      "Rate limited by the usage endpoint. Increase CLAUDE_USAGE_CACHE_MS or poll less often.",
      "RATE_LIMITED",
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ClaudeUsageError(`Usage request failed (${res.status}). ${body}`, "REQUEST_FAILED");
  }

  return (await res.json()) as RawUsage;
}

export async function getClaudeUsage(opts: { force?: boolean } = {}): Promise<UsageCard> {
  const { cacheMs } = runtimeConfig();
  const staleCache = cache?.data ?? null;

  if (!opts.force && cache && Date.now() - cache.ts < cacheMs) {
    return cache.data;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const raw = await fetchRawUsage();
    const data: UsageCard = {
      fiveHour: toCardWindow(raw.five_hour),
      sevenDay: toCardWindow(raw.seven_day),
      sevenDayOpus: toCardWindow(raw.seven_day_opus),
      sevenDaySonnet: toCardWindow(raw.seven_day_sonnet),
      fetchedAt: new Date().toISOString(),
    };
    cache = { data, ts: Date.now() };
    return data;
  })();

  try {
    return await inFlight;
  } catch (error) {
    if (
      !opts.force &&
      staleCache &&
      error instanceof ClaudeUsageError &&
      error.code === "RATE_LIMITED"
    ) {
      return staleCache;
    }
    throw error;
  } finally {
    inFlight = null;
  }
}

export const __internal = {
  resetCache() {
    cache = null;
    inFlight = null;
  },
  toCardWindow,
  runtimeConfig,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  getClaudeUsage({ force: true })
    .then((usage) => {
      console.log(JSON.stringify(usage, null, 2));
      process.exit(0);
    })
    .catch((error: unknown) => {
      const message =
        error instanceof ClaudeUsageError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Unknown error";
      console.error(message);
      process.exit(1);
    });
}
