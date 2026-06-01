import { NextResponse } from "next/server";
import { createTask, kanbanWritesEnabled, type CreateTaskInput } from "@/lib/hermes/kanban-write";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/hermes/kanban/tasks — create a task on the active board.
export async function POST(req: Request) {
  if (!kanbanWritesEnabled()) {
    return NextResponse.json({ ok: false, message: "Kanban writes are disabled" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as CreateTaskInput | null;
  if (!body || !body.title?.trim()) {
    return NextResponse.json({ ok: false, message: "Title is required" }, { status: 400 });
  }
  const result = await createTask(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
