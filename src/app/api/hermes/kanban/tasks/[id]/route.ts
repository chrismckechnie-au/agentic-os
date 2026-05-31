import { NextResponse } from "next/server";
import { readTaskDetail } from "@/lib/providers/live/hermes-kanban";

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
