import { NextResponse } from "next/server";
import { readBoardCursor } from "@/lib/providers/live/hermes-kanban";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/hermes/kanban/cursor — cheap poll target (max task_events.id).
// Clients refetch /board only when this changes.
export async function GET() {
  try {
    return NextResponse.json({ cursor: readBoardCursor() });
  } catch {
    return NextResponse.json({ cursor: 0 });
  }
}
