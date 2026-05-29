import { NextResponse } from "next/server";
import { readUsage } from "@/lib/claude-code/reader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const usage = readUsage(30);
    return NextResponse.json(usage);
  } catch {
    return NextResponse.json({ available: false, totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, sessions: 0 });
  }
}
