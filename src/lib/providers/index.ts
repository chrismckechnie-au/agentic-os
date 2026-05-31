import "server-only";

import type { DataProvider } from "@/lib/providers/types";
import type { KanbanBoard, KanbanTask } from "@/lib/types";
import { MockProvider } from "@/lib/providers/mock";
import { LiveProvider } from "@/lib/providers/live";
import {
  dbExists,
  getDbHealth,
  readBoardCursor,
  readTasks,
  resolveDb,
} from "@/lib/providers/live/hermes-kanban";

let cached: DataProvider | null = null;

export function getProvider(): DataProvider {
  if (cached) return cached;

  const source = process.env.DATA_SOURCE ?? "mock";

  switch (source) {
    case "mock":
      cached = new MockProvider();
      break;
    case "live":
      cached = new LiveProvider();
      break;
    default:
      cached = new MockProvider();
      break;
  }

  return cached ?? new MockProvider();
}

export interface KanbanResult {
  tasks: KanbanTask[];
  source: "live" | "mock" | "degraded";
  dbPath: string;
  boardSlug?: string;
  resolution: string;
  reason?: string;
}

/**
 * Hermes kanban tasks. Reads the active Hermes board DB using Hermes' own
 * resolution order; otherwise falls back to mock fixtures. This makes the board
 * genuinely live wherever the DB is present, independent of DATA_SOURCE, and
 * never breaks when Hermes hasn't created a board yet.
 */
export async function getKanbanTasks(): Promise<KanbanResult> {
  const resolved = resolveDb();
  const dbPath = resolved.dbPath;
  const health = getDbHealth(dbPath);
  if (health.readable) {
    try {
      return {
        tasks: readTasks(dbPath),
        source: "live",
        dbPath,
        boardSlug: resolved.boardSlug,
        resolution: resolved.resolution,
      };
    } catch (err) {
      console.error("[kanban] live DB read failed; falling back to mock:", err);
      return {
        tasks: await getProvider().getKanban(),
        source: "degraded",
        dbPath,
        boardSlug: resolved.boardSlug,
        resolution: resolved.resolution,
        reason: err instanceof Error ? err.message : "Live kanban DB read failed",
      };
    }
  }
  if (health.available && !health.readable) {
    return {
      tasks: await new MockProvider().getKanban(),
      source: "degraded",
      dbPath,
      boardSlug: resolved.boardSlug,
      resolution: resolved.resolution,
      reason: health.reason,
    };
  }
  if (dbExists(dbPath)) {
    return {
      tasks: await new MockProvider().getKanban(),
      source: "degraded",
      dbPath,
      boardSlug: resolved.boardSlug,
      resolution: resolved.resolution,
      reason: "Live kanban DB is present but unreadable",
    };
  }
  return {
    tasks: await new MockProvider().getKanban(),
    source: "mock",
    dbPath,
    boardSlug: resolved.boardSlug,
    resolution: resolved.resolution,
    reason: resolved.reason,
  };
}

/**
 * Board view for the live Kanban workspace: tasks + summary stats + a change
 * cursor (max task_events.id) the client polls to know when to refetch.
 */
export async function getKanbanBoard(): Promise<KanbanBoard> {
  const result = await getKanbanTasks();
  const active = result.tasks.filter((t) => t.status !== "archived");
  const cursor = result.source === "live" ? readBoardCursor(result.dbPath) : 0;
  return {
    tasks: result.tasks,
    boardSlug: result.boardSlug,
    source: result.source,
    cursor,
    stats: {
      active: active.length,
      running: active.filter((t) => t.status === "running").length,
      blocked: active.filter((t) => t.status === "blocked").length,
      review: active.filter((t) => t.status === "review").length,
      done: active.filter((t) => t.status === "done").length,
    },
  };
}
