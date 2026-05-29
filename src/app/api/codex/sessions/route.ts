import { NextResponse } from "next/server";
import { readSessions } from "@/lib/codex/reader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = readSessions(50);
    return NextResponse.json({ sessions, available: sessions.length > 0 });
  } catch {
    return NextResponse.json({ sessions: [], available: false });
  }
}
