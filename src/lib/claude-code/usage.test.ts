import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  __internal,
  ClaudeUsageError,
  getClaudeUsage,
} from "./usage.ts";

const originalFetch = globalThis.fetch;
const originalCredsPath = process.env.CLAUDE_CREDENTIALS_PATH;
const originalCacheMs = process.env.CLAUDE_USAGE_CACHE_MS;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

async function createCredentialsFile(data: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agentic-os-claude-usage-"));
  const file = join(dir, ".credentials.json");
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
  return file;
}

afterEach(async () => {
  const testCredsPath = process.env.CLAUDE_CREDENTIALS_PATH;
  globalThis.fetch = originalFetch;
  if (originalCredsPath === undefined) delete process.env.CLAUDE_CREDENTIALS_PATH;
  else process.env.CLAUDE_CREDENTIALS_PATH = originalCredsPath;
  if (originalCacheMs === undefined) delete process.env.CLAUDE_USAGE_CACHE_MS;
  else process.env.CLAUDE_USAGE_CACHE_MS = originalCacheMs;
  __internal.resetCache();

  if (testCredsPath) {
    await rm(dirname(testCredsPath), { recursive: true, force: true }).catch(() => {});
  }
});

test("throws NO_CREDENTIALS when the Claude token file is missing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agentic-os-claude-usage-missing-"));
  const file = join(dir, ".credentials.json");
  process.env.CLAUDE_CREDENTIALS_PATH = file;

  await assert.rejects(
    getClaudeUsage({ force: true }),
    (error: unknown) =>
      error instanceof ClaudeUsageError && error.code === "NO_CREDENTIALS",
  );

  await rm(dir, { recursive: true, force: true });
});

test("refreshes an expired token, writes it back, and returns usage", async () => {
  const file = await createCredentialsFile({
    claudeAiOauth: {
      accessToken: "old-access",
      refreshToken: "old-refresh",
      expiresAt: Date.now() - 60_000,
      scopes: ["user:inference", "user:profile"],
    },
  });
  process.env.CLAUDE_CREDENTIALS_PATH = file;

  let step = 0;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    step += 1;
    const url = String(input);
    if (step === 1) {
      assert.equal(url, "https://platform.claude.com/v1/oauth/token");
      assert.equal(init?.method, "POST");
      return jsonResponse(200, {
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
      });
    }

    assert.equal(url, "https://api.anthropic.com/api/oauth/usage");
    return jsonResponse(200, {
      five_hour: { utilization: 33, resets_at: "2026-06-01T14:00:00Z" },
      seven_day: { utilization: 13, resets_at: "2026-06-07T00:59:59Z" },
      seven_day_opus: null,
      seven_day_sonnet: { utilization: 1, resets_at: "2026-06-06T03:00:00Z" },
    });
  }) as typeof fetch;

  const usage = await getClaudeUsage({ force: true });
  assert.equal(usage.fiveHour?.pct, 33);
  assert.equal(usage.sevenDay?.pct, 13);
  assert.equal(usage.sevenDaySonnet?.pct, 1);

  const saved = JSON.parse(await readFile(file, "utf8")) as {
    claudeAiOauth: { accessToken: string; refreshToken: string; expiresAt: number };
  };
  assert.equal(saved.claudeAiOauth.accessToken, "new-access");
  assert.equal(saved.claudeAiOauth.refreshToken, "new-refresh");
  assert.ok(saved.claudeAiOauth.expiresAt > Date.now());
});

test("retries exactly once after a 401 from the usage endpoint", async () => {
  const file = await createCredentialsFile({
    claudeAiOauth: {
      accessToken: "still-valid",
      refreshToken: "refresh-me",
      expiresAt: Date.now() + 3_600_000,
      scopes: ["user:inference", "user:profile"],
    },
  });
  process.env.CLAUDE_CREDENTIALS_PATH = file;

  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (calls.length === 1) return jsonResponse(401, { error: "expired" });
    if (calls.length === 2) {
      return jsonResponse(200, {
        access_token: "fresh-access",
        refresh_token: "fresh-refresh",
        expires_in: 3600,
      });
    }
    return jsonResponse(200, {
      five_hour: { utilization: 40, resets_at: "2026-06-01T14:00:00Z" },
      seven_day: { utilization: 20, resets_at: "2026-06-07T00:59:59Z" },
      seven_day_opus: null,
      seven_day_sonnet: null,
    });
  }) as typeof fetch;

  const usage = await getClaudeUsage({ force: true });
  assert.equal(usage.fiveHour?.pct, 40);
  assert.deepEqual(calls, [
    "https://api.anthropic.com/api/oauth/usage",
    "https://platform.claude.com/v1/oauth/token",
    "https://api.anthropic.com/api/oauth/usage",
  ]);
});

test("uses the current access token when refresh is rate limited but usage still succeeds", async () => {
  const file = await createCredentialsFile({
    claudeAiOauth: {
      accessToken: "stale-but-usable",
      refreshToken: "refresh-blocked",
      expiresAt: Date.now() - 60_000,
      scopes: ["user:inference", "user:profile"],
    },
  });
  process.env.CLAUDE_CREDENTIALS_PATH = file;

  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (calls.length === 1) {
      return jsonResponse(429, {
        error: { type: "rate_limit_error", message: "Rate limited. Please try again later." },
      });
    }

    return jsonResponse(200, {
      five_hour: { utilization: 28, resets_at: "2026-06-01T14:00:00Z" },
      seven_day: { utilization: 16, resets_at: "2026-06-07T00:59:59Z" },
      seven_day_opus: null,
      seven_day_sonnet: null,
    });
  }) as typeof fetch;

  const usage = await getClaudeUsage({ force: true });
  assert.equal(usage.fiveHour?.pct, 28);
  assert.equal(usage.sevenDay?.pct, 16);
  assert.deepEqual(calls, [
    "https://platform.claude.com/v1/oauth/token",
    "https://api.anthropic.com/api/oauth/usage",
  ]);
});

test("dedupes concurrent callers behind a shared in-flight request", async () => {
  const file = await createCredentialsFile({
    claudeAiOauth: {
      accessToken: "valid-access",
      refreshToken: "valid-refresh",
      expiresAt: Date.now() + 3_600_000,
      scopes: ["user:inference", "user:profile"],
    },
  });
  process.env.CLAUDE_CREDENTIALS_PATH = file;
  process.env.CLAUDE_USAGE_CACHE_MS = "180000";

  let usageCalls = 0;
  globalThis.fetch = (async () => {
    usageCalls += 1;
    return jsonResponse(200, {
      five_hour: { utilization: 22, resets_at: "2026-06-01T14:00:00Z" },
      seven_day: { utilization: 11, resets_at: "2026-06-07T00:59:59Z" },
      seven_day_opus: null,
      seven_day_sonnet: null,
    });
  }) as typeof fetch;

  const [first, second] = await Promise.all([getClaudeUsage(), getClaudeUsage()]);
  assert.equal(first.fiveHour?.pct, 22);
  assert.equal(second.sevenDay?.pct, 11);
  assert.equal(usageCalls, 1);
});

test("reuses the cached snapshot for rapid sequential calls", async () => {
  const file = await createCredentialsFile({
    claudeAiOauth: {
      accessToken: "cached-access",
      refreshToken: "cached-refresh",
      expiresAt: Date.now() + 3_600_000,
      scopes: ["user:inference", "user:profile"],
    },
  });
  process.env.CLAUDE_CREDENTIALS_PATH = file;
  process.env.CLAUDE_USAGE_CACHE_MS = "180000";

  let usageCalls = 0;
  globalThis.fetch = (async () => {
    usageCalls += 1;
    return jsonResponse(200, {
      five_hour: { utilization: 18.4, resets_at: "2026-06-01T14:00:00Z" },
      seven_day: { utilization: 9.7, resets_at: "2026-06-07T00:59:59Z" },
      seven_day_opus: null,
      seven_day_sonnet: null,
    });
  }) as typeof fetch;

  const first = await getClaudeUsage();
  const second = await getClaudeUsage();
  assert.equal(first.fiveHour?.pct, 18.4);
  assert.equal(second.sevenDay?.pct, 9.7);
  assert.equal(usageCalls, 1);
});

test("falls back to the last cached snapshot when Anthropic rate limits a refresh", async () => {
  const file = await createCredentialsFile({
    claudeAiOauth: {
      accessToken: "cached-access",
      refreshToken: "cached-refresh",
      expiresAt: Date.now() + 3_600_000,
      scopes: ["user:inference", "user:profile"],
    },
  });
  process.env.CLAUDE_CREDENTIALS_PATH = file;
  process.env.CLAUDE_USAGE_CACHE_MS = "1";

  let phase: "seed" | "limited" = "seed";
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (phase === "seed") {
      assert.equal(url, "https://api.anthropic.com/api/oauth/usage");
      return jsonResponse(200, {
        five_hour: { utilization: 12, resets_at: "2026-06-01T14:00:00Z" },
        seven_day: { utilization: 7, resets_at: "2026-06-07T00:59:59Z" },
        seven_day_opus: null,
        seven_day_sonnet: null,
      });
    }

    assert.equal(url, "https://api.anthropic.com/api/oauth/usage");
    return jsonResponse(429, {
      error: { type: "rate_limit_error", message: "Rate limited. Please try again later." },
    });
  }) as typeof fetch;

  const first = await getClaudeUsage();
  phase = "limited";
  await new Promise((resolve) => setTimeout(resolve, 10));
  const second = await getClaudeUsage();

  assert.equal(first.fiveHour?.pct, 12);
  assert.equal(second.fiveHour?.pct, 12);
  assert.equal(second.sevenDay?.pct, 7);
});
