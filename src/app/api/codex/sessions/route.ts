import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await getProvider().listSessions("codex");
    return NextResponse.json({ sessions, available: sessions.length > 0 });
  } catch {
    return NextResponse.json({ sessions: [], available: false });
  }
}
