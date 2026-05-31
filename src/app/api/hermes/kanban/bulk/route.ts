import { NextResponse } from "next/server";
import { isTransition, kanbanWritesEnabled, transition } from "@/lib/hermes/kanban-write";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/hermes/kanban/bulk — apply one status transition to many tasks.
// Body: { action, ids: string[], reason?, result? }
export async function POST(req: Request) {
  if (!kanbanWritesEnabled()) {
    return NextResponse.json({ ok: false, message: "Kanban writes are disabled" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as
    | { action?: string; ids?: string[]; reason?: string; result?: string }
    | null;
  const action = body?.action;
  if (!action || !isTransition(action) || !Array.isArray(body?.ids) || body.ids.length === 0) {
    return NextResponse.json({ ok: false, message: "Invalid bulk request" }, { status: 400 });
  }
  const result = await transition(action, body.ids, { reason: body.reason, result: body.result });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
