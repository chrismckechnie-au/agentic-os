import { NextResponse } from "next/server";
import type { HermesCrewActionKind, KanbanMutationResult, KanbanTask, TaskStatus } from "@/lib/types";
import { recordMissionControlAction } from "@/lib/hermes/mission-control-db";
import { isTransition, kanbanWritesEnabled, transition, type TransitionAction } from "@/lib/hermes/kanban-write";
import { readTasks } from "@/lib/providers/live/hermes-kanban";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BulkBody = { action?: string; ids?: string[]; note?: string; issueIds?: string[] } | null;

const ACTION_LABELS: Record<TransitionAction, string> = {
  promote: "Promote tasks",
  unblock: "Unblock tasks",
  block: "Block tasks",
  schedule: "Schedule tasks",
  complete: "Complete tasks",
  archive: "Archive tasks",
};

const COMPATIBLE_STATUSES: Record<TransitionAction, TaskStatus[]> = {
  promote: ["todo"],
  unblock: ["scheduled", "blocked"],
  block: ["todo", "ready", "running"],
  schedule: ["ready"],
  complete: ["running", "review"],
  archive: ["triage", "todo", "scheduled", "ready", "running", "blocked", "review", "done"],
};

function response(result: KanbanMutationResult, status = result.ok ? 200 : 422) {
  return NextResponse.json(result, { status });
}

export async function POST(req: Request) {
  if (!kanbanWritesEnabled()) {
    return response({ ok: false, message: "Kanban writes are disabled", refreshHints: { board: false, dashboard: false } }, 403);
  }

  const body = (await req.json().catch(() => null)) as BulkBody;
  const action = body?.action;
  const note = body?.note?.trim();
  const ids = Array.isArray(body?.ids)
    ? Array.from(new Set(body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)))
    : [];
  const issueIds = Array.isArray(body?.issueIds) ? body.issueIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];

  if (issueIds.length > 0 && issueIds.length !== ids.length) {
    return response(
      {
        ok: false,
        message: "Bulk request issue metadata is out of sync with the selected tasks.",
        detail: "Refresh the dashboard and retry so each task transition has exactly one matching issue id for audit history.",
        refreshHints: { board: false, dashboard: true },
      },
      400,
    );
  }

  if (!action || !isTransition(action) || ids.length === 0) {
    return response({ ok: false, message: "Invalid bulk request", refreshHints: { board: false, dashboard: false } }, 400);
  }
  if (!note) {
    return response(
      {
        ok: false,
        message: `${ACTION_LABELS[action]} require one shared operator note.`,
        detail: "Add the handoff/result note once and reuse it for the whole compatible selection.",
        refreshHints: { board: false, dashboard: false },
      },
      400,
    );
  }

  const tasks = readTasks() as KanbanTask[];
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const missing = ids.filter((id) => !taskMap.has(id));
  if (missing.length > 0) {
    return response(
      {
        ok: false,
        message: "Bulk selection includes tasks that are no longer on the active board.",
        detail: `Missing task ids: ${missing.join(", ")}`,
        refreshHints: { board: true, dashboard: true },
      },
      409,
    );
  }

  const allowedStatuses = new Set(COMPATIBLE_STATUSES[action]);
  const incompatible = ids
    .map((id) => taskMap.get(id)!)
    .filter((task) => !allowedStatuses.has(task.status))
    .map((task) => `${task.id} (${task.status})`);
  if (incompatible.length > 0) {
    return response(
      {
        ok: false,
        message: `${ACTION_LABELS[action]} only work on a compatible selection.`,
        detail: `Incompatible tasks: ${incompatible.join(", ")}. Allowed statuses: ${Array.from(allowedStatuses).join(", ")}.`,
        refreshHints: { board: false, dashboard: false },
      },
      409,
    );
  }

  const bridge = await transition(action, ids, {
    reason: action === "complete" ? undefined : note,
    result: action === "complete" ? note : undefined,
  });

  const result: KanbanMutationResult = {
    ok: bridge.ok,
    message: bridge.ok ? `${ACTION_LABELS[action]} succeeded for ${ids.length} task${ids.length === 1 ? "" : "s"}` : `${ACTION_LABELS[action]} failed`,
    detail: bridge.message,
    refreshHints: { board: true, dashboard: true },
  };

  ids.forEach((id, index) => {
    const audit = recordMissionControlAction({
      actionKind: "change_task_status" as HermesCrewActionKind,
      targetKind: "task",
      targetId: id,
      issueId: issueIds[index] ?? `task:${id}`,
      profile: taskMap.get(id)?.assignee,
      outcome: result.ok ? "success" : "failure",
      note,
      summary: result.message,
      detail: result.detail,
    });
    if (!audit.ok) {
      result.detail = [result.detail, `Audit warning for ${id}: ${audit.message}`].filter(Boolean).join("\n\n");
    }
  });

  return response(result, result.ok ? 200 : 422);
}
