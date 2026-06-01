import { NextResponse } from "next/server";
import { ackMissionControlEvent, crewActionsEnabled } from "@/lib/hermes/mission-control-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crewActionsEnabled()) {
    return NextResponse.json({ ok: false, message: "Hermes crew actions are disabled" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { note?: string } | null;
  const result = ackMissionControlEvent(id, body?.note);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
