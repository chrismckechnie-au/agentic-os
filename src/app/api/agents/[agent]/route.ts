import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { isAgentId } from "@/lib/config/agents";

export async function GET(_req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!isAgentId(agent)) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }
  const data = await getProvider().getAgentPage(agent);
  return NextResponse.json(data);
}
