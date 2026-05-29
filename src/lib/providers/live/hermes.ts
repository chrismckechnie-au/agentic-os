import "server-only";

import type { KanbanTask } from "@/lib/types";
import type { AgentPageData } from "@/lib/providers/types";
import { readTasks } from "./hermes-kanban";

// Live Hermes source (Nous Research hermes-agent).
//
// TODO(live): read from ~/.hermes/
//   - Sessions: FTS5 SQLite index -> Session[] + transcripts.
//   - Skills: ~/.hermes/skills/ directory listing -> Skill[].
//   - Jobs: cron scheduler config -> Job[] with schedules.
//   - Memory: long-term / working / session store sizes -> MemoryStore[].
//   - createSession(): launch `hermes` or POST to its messaging gateway.

export async function getAgentPage(): Promise<AgentPageData> {
  throw new Error("hermes.getAgentPage not implemented (see TODO).");
}

// Kanban task pipeline — implemented. Reads ~/.hermes/kanban.db (or
// $HERMES_KANBAN_DB) directly via node:sqlite. See ./hermes-kanban.ts.
export async function listTasks(): Promise<KanbanTask[]> {
  return readTasks();
}
