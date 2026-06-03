import { NextResponse } from "next/server";
import type { HermesCrewActionKind, KanbanMutationResult } from "@/lib/types";
import { recordMissionControlAction } from "@/lib/hermes/mission-control-db";
import { readTaskDetail } from "@/lib/providers/live/hermes-kanban";
import {
  addComment,
  assignTask,
  isTransition,
  kanbanWritesEnabled,
  linkTasks,
  transition,
  type BridgeResult,
  type TransitionAction,
} from "@/lib/hermes/kanban-write";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRANSITION_LABELS: Record<TransitionAction, string> = {
  promote: "Promote task",
  unblock: "Unblock task",
  block: "Block task",
  schedule: "Schedule task",
  complete: "Complete task",
  archive: "Archive task",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = readTaskDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch {
    return NextResponse.json({ error: "failed to read task" }, { status: 500 });
  }
}

type Mutation =
  | { op: "comment"; text: string; author?: string }
  | { op: "assign"; profile: string | null; note?: string; issueId?: string }
  | { op: "transition"; action: string; note?: string; issueId?: string }
  | { op: "link" | "unlink"; otherId: string; direction: "depends-on" | "blocks" };

function response(result: KanbanMutationResult, status = result.ok ? 200 : 422) {
  return NextResponse.json(result, { status });
}

function noteRequired(opLabel: string): KanbanMutationResult {
  return {
    ok: false,
    message: `${opLabel} requires an operator note.`,
    detail: "Add the handoff context so future operators can understand why this mutation happened.",
    refreshHints: { board: false, dashboard: false },
  };
}

function bridgeToMutationResult(message: string, result: BridgeResult): KanbanMutationResult {
  return {
    ok: result.ok,
    message,
    detail: result.message,
    refreshHints: { board: true, dashboard: true },
  };
}

function auditSingleTaskMutation(input: {
  taskId: string;
  actionKind: HermesCrewActionKind;
  issueId?: string;
  note?: string;
  outcome: "success" | "failure";
  summary: string;
  detail?: string;
  profile?: string;
}) {
  return recordMissionControlAction({
    actionKind: input.actionKind,
    targetKind: "task",
    targetId: input.taskId,
    issueId: input.issueId ?? `task:${input.taskId}`,
    profile: input.profile,
    outcome: input.outcome,
    note: input.note,
    summary: input.summary,
    detail: input.detail,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!kanbanWritesEnabled()) {
    return response({ ok: false, message: "Kanban writes are disabled", refreshHints: { board: false, dashboard: false } }, 403);
  }

  const { id } = await params;
  const task = readTaskDetail(id);
  if (!task) {
    return response({ ok: false, message: "Task not found", refreshHints: { board: false, dashboard: false } }, 404);
  }

  const body = (await req.json().catch(() => null)) as Mutation | null;
  if (!body || typeof body.op !== "string") {
    return response({ ok: false, message: "Invalid request body", refreshHints: { board: false, dashboard: false } }, 400);
  }

  let result: KanbanMutationResult;
  let actionKind: HermesCrewActionKind | undefined;
  let note: string | undefined;

  switch (body.op) {
    case "comment": {
      const bridge = await addComment(id, body.text ?? "", body.author);
      result = bridgeToMutationResult(bridge.ok ? `Added comment to ${id}` : `Failed to add comment to ${id}`, bridge);
      break;
    }
    case "assign": {
      note = body.note?.trim();
      if (!note) return response(noteRequired("Task reassignment"), 400);
      const normalizedProfile = typeof body.profile === "string" ? body.profile.trim() : body.profile;
      actionKind = "reassign_task";
      const bridge = await assignTask(id, normalizedProfile ?? null);
      result = bridgeToMutationResult(
        bridge.ok ? `Reassigned ${id}${normalizedProfile ? ` to ${normalizedProfile}` : " to the unassigned lane"}` : `Failed to reassign ${id}`,
        bridge,
      );
      break;
    }
    case "transition": {
      if (!isTransition(body.action)) {
        return response({ ok: false, message: "Unknown action", refreshHints: { board: false, dashboard: false } }, 400);
      }
      note = body.note?.trim();
      if (!note) return response(noteRequired(TRANSITION_LABELS[body.action]), 400);
      actionKind = "change_task_status";
      const bridge = await transition(body.action, [id], {
        reason: body.action === "complete" ? undefined : note,
        result: body.action === "complete" ? note : undefined,
      });
      result = bridgeToMutationResult(
        bridge.ok ? `${TRANSITION_LABELS[body.action]} succeeded for ${id}` : `${TRANSITION_LABELS[body.action]} failed for ${id}`,
        bridge,
      );
      break;
    }
    case "link":
    case "unlink": {
      const unlink = body.op === "unlink";
      const bridge = body.direction === "blocks" ? await linkTasks(id, body.otherId, unlink) : await linkTasks(body.otherId, id, unlink);
      result = bridgeToMutationResult(
        bridge.ok ? `${unlink ? "Removed" : "Added"} ${body.direction} link for ${id}` : `Failed to update links for ${id}`,
        bridge,
      );
      break;
    }
    default:
      return response({ ok: false, message: "Unknown op", refreshHints: { board: false, dashboard: false } }, 400);
  }

  if (actionKind) {
    const audit = auditSingleTaskMutation({
      taskId: id,
      actionKind,
      issueId: body.op === "assign" || body.op === "transition" ? body.issueId : undefined,
      note,
      outcome: result.ok ? "success" : "failure",
      summary: result.message,
      detail: result.detail,
      profile: body.op === "assign" && typeof body.profile === "string" ? body.profile.trim() || undefined : task.assignee,
    });
    if (!audit.ok) result.detail = [result.detail, `Audit warning: ${audit.message}`].filter(Boolean).join("\n\n");
  }

  return response(result, result.ok ? 200 : 422);
}
