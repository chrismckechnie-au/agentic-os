import { NextResponse } from "next/server";
import { getHermesCrewDashboard } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const dashboard = await getHermesCrewDashboard();
  return NextResponse.json(dashboard.activity);
}
