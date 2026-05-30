import { NextResponse } from "next/server";
import { getKanbanTasks } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const { tasks, source, dbPath, boardSlug, resolution, reason } = await getKanbanTasks();
  return NextResponse.json({ source, dbPath, boardSlug, resolution, reason, tasks });
}
