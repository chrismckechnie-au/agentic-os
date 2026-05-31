import { NextResponse } from "next/server";
import { readTaskDetail } from "@/lib/providers/live/hermes-kanban";
import {
  addComment,
  assignTask,
  isTransition,
  kanbanWritesEnabled,
  linkTasks,
  transition,
  type BridgeResult,
} from "@/lib/hermes/kanban-write";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/hermes/kanban/tasks/:id — task drawer payload (comments, links,
// runs, recent events). 404 when the task isn't on the active board.
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
  | { op: "assign"; profile: string | null }
  | { op: "transition"; action: string; reason?: string; result?: string }
  | { op: "link" | "unlink"; otherId: string; direction: "depends-on" | "blocks" };

// POST /api/hermes/kanban/tasks/:id — mutate a single task. Gated behind
// AGENTIC_ENABLE_KANBAN_WRITES; returns { ok, message } from the hermes CLI.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!kanbanWritesEnabled()) {
    return NextResponse.json({ ok: false, message: "Kanban writes are disabled" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Mutation | null;
  if (!body || typeof body.op !== "string") {
    return NextResponse.json({ ok: false, message: "Invalid request body" }, { status: 400 });
  }

  let result: BridgeResult;
  switch (body.op) {
    case "comment":
      result = await addComment(id, body.text ?? "", body.author);
      break;
    case "assign":
      result = await assignTask(id, body.profile ?? null);
      break;
    case "transition":
      if (!isTransition(body.action)) {
        return NextResponse.json({ ok: false, message: "Unknown action" }, { status: 400 });
      }
      result = await transition(body.action, [id], { reason: body.reason, result: body.result });
      break;
    case "link":
    case "unlink": {
      const unlink = body.op === "unlink";
      // depends-on: other is the parent (blocker) of this task; blocks: this is the parent.
      result =
        body.direction === "blocks"
          ? await linkTasks(id, body.otherId, unlink)
          : await linkTasks(body.otherId, id, unlink);
      break;
    }
    default:
      return NextResponse.json({ ok: false, message: "Unknown op" }, { status: 400 });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
