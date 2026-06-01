import { NextResponse } from "next/server";
import { cronActionsEnabled, isCronAction, runCronAction } from "@/lib/hermes/cron-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!cronActionsEnabled()) {
    return NextResponse.json({ ok: false, message: "Hermes crew actions are disabled" }, { status: 403 });
  }
  const { id, action } = await params;
  if (!isCronAction(action)) {
    return NextResponse.json({ ok: false, message: "Unsupported cron action" }, { status: 400 });
  }
  const result = await runCronAction(id, action);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
