import { NextResponse } from "next/server";
import { ClaudeUsageError, getClaudeUsage } from "@/lib/claude-code/usage.server";

export const dynamic = "force-dynamic";

function statusFor(error: ClaudeUsageError): number {
  return error.code === "RATE_LIMITED"
    ? 429
    : error.code === "UNAUTHORIZED"
      ? 401
      : error.code === "NO_CREDENTIALS"
        ? 503
        : 500;
}

export async function GET() {
  try {
    const usage = await getClaudeUsage();
    return NextResponse.json(usage, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    if (error instanceof ClaudeUsageError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusFor(error) },
      );
    }

    return NextResponse.json(
      { error: "Unknown Claude usage error", code: "REQUEST_FAILED" },
      { status: 500 },
    );
  }
}
