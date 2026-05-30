import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { isAgentId } from "@/lib/config/agents";

export async function GET(_req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!isAgentId(agent)) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }
  const sessions = await getProvider().listSessions(agent);
  return NextResponse.json(sessions);
}

export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!isAgentId(agent)) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }
  const { prompt } = (await req.json().catch(() => ({}))) as { prompt?: string };
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }
  try {
    const result = await getProvider().createSession(agent, prompt);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create session";
    const status = /not enabled|disabled/i.test(message) ? 501 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
