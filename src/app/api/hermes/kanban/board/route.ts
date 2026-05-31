import { NextResponse } from "next/server";
import { getKanbanBoard } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/hermes/kanban/board — live board tasks + stats + change cursor.
export async function GET() {
  try {
    return NextResponse.json(await getKanbanBoard());
  } catch {
    return NextResponse.json(
      {
        tasks: [],
        source: "mock",
        cursor: 0,
        stats: { active: 0, running: 0, blocked: 0, review: 0, done: 0 },
        writesEnabled: false,
      },
      { status: 200 },
    );
  }
}
