import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { isAgentId } from "@/lib/config/agents";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const filter = agent && isAgentId(agent) ? agent : undefined;
  const sessions = await getProvider().listSessions(filter);
  return NextResponse.json(sessions);
}
