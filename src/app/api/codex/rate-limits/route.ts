import { NextResponse } from "next/server";
import { CodexRateLimitsError, getCodexRateLimits } from "@/lib/codex/rate-limits.server";

export const dynamic = "force-dynamic";

function statusFor(error: CodexRateLimitsError): number {
  return error.code === "NO_DATA" ? 503 : 500;
}

export async function GET() {
  try {
    const usage = await getCodexRateLimits();
    return NextResponse.json(usage, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    if (error instanceof CodexRateLimitsError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusFor(error) },
      );
    }

    return NextResponse.json(
      { error: "Unknown Codex rate-limit error", code: "REQUEST_FAILED" },
      { status: 500 },
    );
  }
}
