import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET() {
  const agents = await getProvider().listAgents();
  return NextResponse.json(agents);
}
