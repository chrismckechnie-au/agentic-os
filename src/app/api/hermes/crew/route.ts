import { NextResponse } from "next/server";
import { getHermesCrewDashboard } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getHermesCrewDashboard());
}
