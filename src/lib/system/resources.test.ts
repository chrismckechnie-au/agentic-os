import assert from "node:assert/strict";
import type { CpuInfo } from "node:os";
import { test } from "node:test";
import { calculateCpuUsage, calculateMemoryUsage, formatBytes, summarizeCpuSample } from "./resources.ts";

test("calculates CPU usage from idle and total deltas", () => {
  assert.equal(calculateCpuUsage({ idle: 100, total: 200 }, { idle: 125, total: 300 }), 75);
});

test("guards CPU usage against invalid deltas", () => {
  assert.equal(calculateCpuUsage({ idle: 100, total: 200 }, { idle: 110, total: 200 }), 0);
});

test("summarizes CPU samples across cores", () => {
  const sample = summarizeCpuSample([
    { times: { user: 10, nice: 0, sys: 5, idle: 85, irq: 0 } },
    { times: { user: 20, nice: 1, sys: 9, idle: 70, irq: 0 } },
  ] as CpuInfo[]);

  assert.deepEqual(sample, { idle: 155, total: 200 });
});

test("calculates memory usage percentage", () => {
  assert.deepEqual(calculateMemoryUsage(1000, 250), {
    totalMemoryBytes: 1000,
    usedMemoryBytes: 750,
    freeMemoryBytes: 250,
    memoryPct: 75,
  });
});

test("formats byte values compactly", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024 * 1024 * 6.5), "6.5 MB");
  assert.equal(formatBytes(1024 * 1024 * 1024 * 24), "24 GB");
});
