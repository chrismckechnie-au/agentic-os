import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveDb } from "@/lib/providers/live/hermes-kanban";

// Server-only write bridge to the Hermes Kanban board.
//
// We shell out to Hermes' own `hermes kanban …` CLI (a stable public contract)
// rather than writing SQLite directly, so Hermes' invariants — claim locks,
// task_events, run state, the status state machine — stay intact. No shell is
// used (execFile with an argv array), every operation is allowlisted, and ids /
// slugs are validated before they reach the command line.
//
// Writes are OFF by default. Set AGENTIC_ENABLE_KANBAN_WRITES=1 to enable. This
// means deploying this code never silently enables live mutations.

const execFileP = promisify(execFile);

const TASK_ID = /^t_[A-Za-z0-9_]+$/;
const PROFILE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const SKILL = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export function kanbanWritesEnabled(): boolean {
  return /^(1|true)$/i.test(process.env.AGENTIC_ENABLE_KANBAN_WRITES ?? "");
}

function hermesBin(): string {
  return process.env.HERMES_BIN?.trim() || "hermes";
}

/** The board slug Agentic OS reads (env override, else the resolved active board). */
function activeBoardSlug(): string | undefined {
  return process.env.HERMES_KANBAN_BOARD?.trim() || resolveDb().boardSlug;
}

export interface BridgeResult {
  ok: boolean;
  message: string;
  /** Parsed JSON for commands run with --json (e.g. create). */
  data?: Record<string, unknown>;
}

const FAIL_PREFIX = /^(error\b|error:|cannot\b|usage:|no\b.*\bfound|failed\b)/i;

/**
 * Classify CLI output. The kanban CLI exits 0 even on logical failures (it
 * prints "cannot promote …" / "Error: …" to stdout), so success is decided by
 * inspecting the output, not the exit code.
 */
function classify(stdout: string, stderr: string): { ok: boolean; message: string } {
  const combined = `${stdout}\n${stderr}`.trim();
  const firstLine = combined.split("\n").find((l) => l.trim()) ?? "";
  const failed = FAIL_PREFIX.test(firstLine.trim()) || /does not exist/i.test(combined);
  return { ok: !failed, message: combined.slice(0, 800) || (failed ? "command failed" : "ok") };
}

function badId(): BridgeResult {
  return { ok: false, message: "Invalid task id" };
}

async function runKanban(args: string[], opts?: { json?: boolean }): Promise<BridgeResult> {
  if (!kanbanWritesEnabled()) {
    return { ok: false, message: "Kanban writes are disabled (set AGENTIC_ENABLE_KANBAN_WRITES=1)" };
  }
  const board = activeBoardSlug();
  const argv = ["kanban", ...(board ? ["--board", board] : []), ...args];
  try {
    const { stdout, stderr } = await execFileP(hermesBin(), argv, {
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    const c = classify(stdout, stderr);
    let data: Record<string, unknown> | undefined;
    if (opts?.json && c.ok) {
      try {
        const parsed = JSON.parse(stdout);
        if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
      } catch {
        /* not JSON */
      }
    }
    return { ...c, data };
  } catch (err) {
    const e = err as { code?: string | number; stdout?: string; stderr?: string; message?: string; killed?: boolean };
    if (e.code === "ENOENT") return { ok: false, message: "hermes CLI not found on PATH (set HERMES_BIN)" };
    if (e.killed) return { ok: false, message: "kanban command timed out" };
    const c = classify(e.stdout ?? "", e.stderr ?? e.message ?? "");
    return { ok: false, message: c.message || "kanban command failed" };
  }
}

// --- allowlisted operations --------------------------------------------------

export interface CreateTaskInput {
  title: string;
  body?: string;
  assignee?: string;
  priority?: number;
  parents?: string[];
  skills?: string[];
  triage?: boolean;
  initialStatus?: "blocked" | "running";
}

export async function createTask(input: CreateTaskInput): Promise<BridgeResult> {
  const title = input.title?.trim();
  if (!title) return { ok: false, message: "Title is required" };

  const args = ["create", title, "--json"];
  if (input.body?.trim()) args.push("--body", input.body.trim());
  if (input.assignee && PROFILE.test(input.assignee)) args.push("--assignee", input.assignee);
  if (typeof input.priority === "number" && Number.isFinite(input.priority)) {
    args.push("--priority", String(Math.trunc(input.priority)));
  }
  for (const p of input.parents ?? []) if (TASK_ID.test(p)) args.push("--parent", p);
  for (const s of input.skills ?? []) if (SKILL.test(s)) args.push("--skill", s);
  if (input.triage) args.push("--triage");
  if (input.initialStatus === "blocked" || input.initialStatus === "running") {
    args.push("--initial-status", input.initialStatus);
  }

  const res = await runKanban(args, { json: true });
  if (res.ok && res.data?.id) return { ...res, message: `Created ${String(res.data.id)}` };
  return res;
}

export async function addComment(taskId: string, text: string, author?: string): Promise<BridgeResult> {
  if (!TASK_ID.test(taskId)) return badId();
  const body = text?.trim();
  if (!body) return { ok: false, message: "Comment text is required" };
  const args = ["comment", taskId, body];
  if (author && PROFILE.test(author)) args.push("--author", author);
  return runKanban(args);
}

export async function assignTask(taskId: string, profile: string | null): Promise<BridgeResult> {
  if (!TASK_ID.test(taskId)) return badId();
  const who = profile && profile.trim() ? profile.trim() : "none";
  if (who !== "none" && !PROFILE.test(who)) return { ok: false, message: "Invalid profile name" };
  return runKanban(["assign", taskId, who]);
}

export async function linkTasks(parentId: string, childId: string, unlink = false): Promise<BridgeResult> {
  if (!TASK_ID.test(parentId) || !TASK_ID.test(childId)) return badId();
  if (parentId === childId) return { ok: false, message: "A task cannot depend on itself" };
  return runKanban([unlink ? "unlink" : "link", parentId, childId]);
}

export type TransitionAction = "promote" | "unblock" | "block" | "schedule" | "complete" | "archive";
const TRANSITIONS: readonly TransitionAction[] = ["promote", "unblock", "block", "schedule", "complete", "archive"];

export function isTransition(action: string): action is TransitionAction {
  return (TRANSITIONS as readonly string[]).includes(action);
}

/**
 * Apply a status transition to one or more tasks. The Hermes CLI enforces the
 * state machine (e.g. promote only from todo/blocked) and reports "cannot …"
 * which classify() surfaces as a failure message.
 */
export async function transition(
  action: TransitionAction,
  ids: string[],
  opts?: { reason?: string; result?: string },
): Promise<BridgeResult> {
  if (!isTransition(action)) return { ok: false, message: "Unknown action" };
  const valid = ids.filter((id) => TASK_ID.test(id));
  if (valid.length === 0) return { ok: false, message: "No valid task ids" };

  if (action === "block") {
    const [first, ...rest] = valid;
    const args = ["block", first];
    if (opts?.reason?.trim()) args.push(opts.reason.trim());
    if (rest.length) args.push("--ids", ...rest);
    return runKanban(args);
  }

  const args = [action, ...valid];
  if (action === "complete" && opts?.result?.trim()) args.push("--result", opts.result.trim());
  return runKanban(args);
}

/** One dispatcher pass: reclaim stale claims, promote ready, spawn workers. */
export async function dispatch(): Promise<BridgeResult> {
  return runKanban(["dispatch"]);
}
