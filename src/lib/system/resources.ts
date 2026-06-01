import os from "node:os";

export interface CpuSample {
  idle: number;
  total: number;
}

export interface SystemResources {
  cpuPct: number;
  memoryPct: number;
  totalMemoryBytes: number;
  usedMemoryBytes: number;
  freeMemoryBytes: number;
  coreCount: number;
  loadAveragePct: number[];
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function summarizeCpuSample(cpus = os.cpus()): CpuSample {
  return cpus.reduce<CpuSample>(
    (acc, cpu) => {
      const times = cpu.times;
      const idle = times.idle;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      return { idle: acc.idle + idle, total: acc.total + total };
    },
    { idle: 0, total: 0 },
  );
}

export function calculateCpuUsage(start: CpuSample, end: CpuSample): number {
  const idleDelta = end.idle - start.idle;
  const totalDelta = end.total - start.total;
  if (totalDelta <= 0) return 0;
  return clampPct((1 - idleDelta / totalDelta) * 100);
}

export function calculateMemoryUsage(totalMemoryBytes = os.totalmem(), freeMemoryBytes = os.freemem()) {
  const total = Math.max(0, totalMemoryBytes);
  const free = Math.max(0, Math.min(total, freeMemoryBytes));
  const used = Math.max(0, total - free);
  return {
    totalMemoryBytes: total,
    usedMemoryBytes: used,
    freeMemoryBytes: free,
    memoryPct: total > 0 ? clampPct((used / total) * 100) : 0,
  };
}

function loadAveragePercentages(coreCount: number): number[] {
  const cores = Math.max(1, coreCount);
  // Linux returns 1/5/15 minute load averages. Reverse to render old -> current.
  return os.loadavg().reverse().map((load) => clampPct((load / cores) * 100));
}

export async function readSystemResources(sampleMs = 120): Promise<SystemResources> {
  const start = summarizeCpuSample();
  await new Promise((resolve) => setTimeout(resolve, sampleMs));
  const end = summarizeCpuSample();
  const memory = calculateMemoryUsage();
  const coreCount = Math.max(1, os.cpus().length);

  return {
    cpuPct: calculateCpuUsage(start, end),
    ...memory,
    coreCount,
    loadAveragePct: loadAveragePercentages(coreCount),
  };
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const maximumFractionDigits = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(maximumFractionDigits)} ${units[unit]}`;
}
