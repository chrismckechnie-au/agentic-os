import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { crewActionsEnabled } from "./mission-control-db";

const execFileP = promisify(execFile);
const JOB_ID = /^[A-Za-z0-9_-]{6,64}$/;
const ACTIONS = ["run", "pause", "resume"] as const;

export type CronAction = (typeof ACTIONS)[number];

export interface CronActionResult {
  ok: boolean;
  message: string;
}

export function cronActionsEnabled(): boolean {
  return crewActionsEnabled();
}

export function isCronAction(value: string): value is CronAction {
  return (ACTIONS as readonly string[]).includes(value);
}

function hermesBin(): string {
  return process.env.HERMES_BIN?.trim() || "hermes";
}

export async function runCronAction(jobId: string, action: CronAction): Promise<CronActionResult> {
  if (!cronActionsEnabled()) return { ok: false, message: "Hermes crew actions are disabled" };
  if (!JOB_ID.test(jobId)) return { ok: false, message: "Invalid cron job id" };

  try {
    const { stdout, stderr } = await execFileP(hermesBin(), ["cron", action, jobId], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const message = `${stdout}\n${stderr}`.trim() || "ok";
    return { ok: !/^error\b|^failed\b|not found/i.test(message), message: message.slice(0, 800) };
  } catch (err) {
    const e = err as { code?: string | number; stdout?: string; stderr?: string; message?: string; killed?: boolean };
    if (e.code === "ENOENT") return { ok: false, message: "hermes CLI not found on PATH (set HERMES_BIN)" };
    if (e.killed) return { ok: false, message: "cron command timed out" };
    return { ok: false, message: (e.stderr || e.stdout || e.message || "cron command failed").slice(0, 800) };
  }
}
