import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "../types";
import { filterOverviewSessions, isHermesCronSession } from "./session-filters.ts";

test("identifies Hermes cron sessions by workspace source", () => {
  const session: Session = {
    id: "hm-1",
    agentId: "hermes",
    title: "Nightly sync",
    workspace: " cron ",
    status: "completed",
    updatedAt: "5m ago",
  };

  assert.equal(isHermesCronSession(session), true);
});

test("keeps non-cron sessions in overview data", () => {
  const sessions: Session[] = [
    {
      id: "hm-1",
      agentId: "hermes",
      title: "Nightly sync",
      workspace: "cron",
      status: "completed",
      updatedAt: "5m ago",
    },
    {
      id: "hm-2",
      agentId: "hermes",
      title: "Investigate board drift",
      workspace: "cli",
      status: "active",
      updatedAt: "2m ago",
    },
    {
      id: "cx-1",
      agentId: "codex",
      title: "Ship overview cleanup",
      workspace: "agentic-os",
      status: "in_progress",
      updatedAt: "1m ago",
    },
  ];

  assert.deepEqual(
    filterOverviewSessions(sessions).map((session) => session.id),
    ["hm-2", "cx-1"],
  );
});
