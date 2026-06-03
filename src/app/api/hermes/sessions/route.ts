import { NextResponse } from "next/server";
import { getStateDbHealth, readSessionRows } from "@/lib/hermes/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/hermes/sessions?q=&limit=&offset=
// Paginated + FTS-searchable Hermes chat history from the active profile's
// state.db. Degrades to an empty, available:false payload when the DB can't be
// read (older Node, missing profile) so the UI can show a graceful message.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
    const limit = Number(url.searchParams.get("limit") ?? 40);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const safeLimit = Number.isFinite(limit) ? limit : 40;
    const safeOffset = Number.isFinite(offset) ? offset : 0;

    const health = getStateDbHealth();
    if (!health.readable) {
      return NextResponse.json({
        sessions: [],
        total: 0,
        limit: safeLimit,
        offset: safeOffset,
        hasMore: false,
        query: q,
        available: false,
        reason: health.reason,
      });
    }

    const { rows, total } = readSessionRows({ limit: safeLimit, offset: safeOffset, query: q, excludeCron: true });
    return NextResponse.json({
      sessions: rows,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + rows.length < total,
      query: q,
      available: true,
    });
  } catch {
    return NextResponse.json(
      { sessions: [], total: 0, limit: 40, offset: 0, hasMore: false, available: false },
      { status: 200 },
    );
  }
}
