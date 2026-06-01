import { NextResponse } from "next/server";
import { dispatch, kanbanWritesEnabled } from "@/lib/hermes/kanban-write";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/hermes/kanban/dispatch — one dispatcher pass (reclaim stale, promote
// ready, spawn workers). Gated; this actually executes work, so it's explicit.
export async function POST() {
  if (!kanbanWritesEnabled()) {
    return NextResponse.json({ ok: false, message: "Kanban writes are disabled" }, { status: 403 });
  }
  const result = await dispatch();
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
