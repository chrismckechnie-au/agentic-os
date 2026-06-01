import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  __internal,
  CodexRateLimitsError,
  getCodexRateLimits,
} from "./rate-limits.ts";

const originalCodexHome = process.env.CODEX_HOME;
const originalCacheMs = process.env.CODEX_RATE_LIMITS_CACHE_MS;

async function createCodexHome(files: Array<{ rel: string; content: string }>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agentic-os-codex-rate-limits-"));
  for (const file of files) {
    const target = join(root, file.rel);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, { encoding: "utf8", flag: "w" });
  }
  return root;
}

afterEach(async () => {
  const codexHome = process.env.CODEX_HOME;
  if (originalCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = originalCodexHome;
  if (originalCacheMs === undefined) delete process.env.CODEX_RATE_LIMITS_CACHE_MS;
  else process.env.CODEX_RATE_LIMITS_CACHE_MS = originalCacheMs;
  __internal.resetCache();

  if (codexHome) {
    await rm(dirname(join(codexHome, "session_index.jsonl")), { recursive: true, force: true }).catch(() => {});
  }
});

test("returns the latest usable 5h and 7d windows from Codex session snapshots", async () => {
  const home = await createCodexHome([
    {
      rel: "session_index.jsonl",
      content: [
        JSON.stringify({ id: "older", updated_at: "2026-05-31T12:00:00.000Z" }),
        JSON.stringify({ id: "latest", updated_at: "2026-06-01T10:45:47.308Z" }),
      ].join("\n"),
    },
    {
      rel: "sessions/2026/05/31/rollout-older.jsonl",
      content: JSON.stringify({
        timestamp: "2026-05-31T12:00:00.000Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          rate_limits: {
            limit_id: "codex",
            primary: { used_percent: 15, window_minutes: 300, resets_at: 1780230000 },
            secondary: { used_percent: 9, window_minutes: 10080, resets_at: 1780750000 },
            plan_type: "prolite",
            rate_limit_reached_type: null,
          },
        },
      }),
    },
    {
      rel: "sessions/2026/06/01/rollout-latest.jsonl",
      content: [
        JSON.stringify({
          timestamp: "2026-06-01T10:44:56.937Z",
          type: "event_msg",
          payload: {
            type: "token_count",
            rate_limits: {
              limit_id: "codex",
              primary: { used_percent: 0, window_minutes: 0, resets_at: 1780309964 },
              secondary: null,
              plan_type: "prolite",
              rate_limit_reached_type: null,
            },
          },
        }),
        JSON.stringify({
          timestamp: "2026-06-01T10:45:47.308Z",
          type: "event_msg",
          payload: {
            type: "token_count",
            rate_limits: {
              limit_id: "codex",
              primary: { used_percent: 44, window_minutes: 300, resets_at: 1780314065 },
              secondary: { used_percent: 24, window_minutes: 10080, resets_at: 1780846053 },
              plan_type: "prolite",
              rate_limit_reached_type: null,
            },
          },
        }),
      ].join("\n"),
    },
  ]);

  process.env.CODEX_HOME = home;
  const usage = await getCodexRateLimits({ force: true });

  assert.equal(usage.fiveHour?.pct, 44);
  assert.equal(usage.fiveHour?.windowDurationMins, 300);
  assert.equal(usage.sevenDay?.pct, 24);
  assert.equal(usage.sevenDay?.windowDurationMins, 10080);
  assert.equal(usage.planType, "prolite");
  assert.equal(usage.source, "session");
  assert.equal(usage.updatedAt, "2026-06-01T10:45:47.308Z");
});

test("throws NO_DATA when the Codex session index is missing", async () => {
  const home = await mkdtemp(join(tmpdir(), "agentic-os-codex-rate-limits-missing-"));
  process.env.CODEX_HOME = home;

  await assert.rejects(
    getCodexRateLimits({ force: true }),
    (error: unknown) =>
      error instanceof CodexRateLimitsError && error.code === "NO_DATA",
  );

  await rm(home, { recursive: true, force: true });
});

test("reuses the cached Codex snapshot for rapid sequential calls", async () => {
  const home = await createCodexHome([
    {
      rel: "session_index.jsonl",
      content: JSON.stringify({ id: "latest", updated_at: "2026-06-01T10:45:47.308Z" }),
    },
    {
      rel: "sessions/2026/06/01/rollout-latest.jsonl",
      content: JSON.stringify({
        timestamp: "2026-06-01T10:45:47.308Z",
        type: "event_msg",
        payload: {
          type: "token_count",
          rate_limits: {
            limit_id: "codex",
            primary: { used_percent: 44, window_minutes: 300, resets_at: 1780314065 },
            secondary: { used_percent: 24, window_minutes: 10080, resets_at: 1780846053 },
            plan_type: "prolite",
            rate_limit_reached_type: null,
          },
        },
      }),
    },
  ]);

  process.env.CODEX_HOME = home;
  process.env.CODEX_RATE_LIMITS_CACHE_MS = "180000";
  const first = await getCodexRateLimits();

  await writeFile(
    join(home, "sessions/2026/06/01/rollout-latest.jsonl"),
    JSON.stringify({
      timestamp: "2026-06-01T10:50:00.000Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        rate_limits: {
          limit_id: "codex",
          primary: { used_percent: 80, window_minutes: 300, resets_at: 1780315000 },
          secondary: { used_percent: 50, window_minutes: 10080, resets_at: 1780847000 },
          plan_type: "prolite",
          rate_limit_reached_type: null,
        },
      },
    }),
    "utf8",
  );

  const second = await getCodexRateLimits();
  assert.equal(first.fiveHour?.pct, 44);
  assert.equal(second.fiveHour?.pct, 44);
});
