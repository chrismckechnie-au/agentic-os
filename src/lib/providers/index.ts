import "server-only";

import type { DataProvider } from "@/lib/providers/types";
import type { KanbanTask } from "@/lib/types";
import { MockProvider } from "@/lib/providers/mock";
import { dbExists, readTasks, resolveDbPath } from "@/lib/providers/live/hermes-kanban";

// Resolve the active data provider once per process.
//
//   DATA_SOURCE=mock   (default) -> static fixtures, no I/O
//   DATA_SOURCE=live             -> real sources (see ./live). Not built yet;
//                                   throws until the live providers are wired.
//
// This factory is the ONLY place that decides where data comes from. The UI
// and API routes depend on the DataProvider interface, never a concrete source.

let cached: DataProvider | null = null;

export function getProvider(): DataProvider {
  if (cached) return cached;

  const source = process.env.DATA_SOURCE ?? "mock";

  switch (source) {
    case "mock":
      cached = new MockProvider();
      break;
    case "live":
    default:
      // Real data is wired directly in page.tsx / route handlers (not through
      // the provider). MockProvider supplies the base scaffold that those
      // readers override, so live mode falls through to mock here.
      cached = new MockProvider();
      break;
  }

  return cached;
}

export interface KanbanResult {
  tasks: KanbanTask[];
  source: "live" | "mock";
  dbPath: string;
}

/**
 * Hermes kanban tasks. Reads the real ~/.hermes/kanban.db (or $HERMES_KANBAN_DB)
 * when that file exists; otherwise falls back to mock fixtures. This makes the
 * board genuinely live wherever the DB is present, independent of DATA_SOURCE,
 * and never breaks when Hermes hasn't created a board yet.
 */
export async function getKanbanTasks(): Promise<KanbanResult> {
  const dbPath = resolveDbPath();
  if (dbExists(dbPath)) {
    try {
      return { tasks: readTasks(dbPath), source: "live", dbPath };
    } catch (err) {
      console.error("[kanban] live DB read failed; falling back to mock:", err);
    }
  }
  return { tasks: await getProvider().getKanban(), source: "mock", dbPath };
}
