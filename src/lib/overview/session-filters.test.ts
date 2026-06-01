import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "../types";
import { filterNonCronSessions, isHermesCronSession } from "./session-filters.ts";

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

test("identifies Hermes cron sessions by generated conversation ids", () => {
  const session: Session = {
    id: "cron_6a6446c872cd_20260601_190919",
    agentId: "hermes",
    title: "Conversation cron_6a6446c",
    workspace: "hermes-agent",
    status: "completed",
    updatedAt: "just now",
  };

  assert.equal(isHermesCronSession(session), true);
});

test("keeps non-cron sessions in homepage data", () => {
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
    filterNonCronSessions(sessions).map((session) => session.id),
    ["hm-2", "cx-1"],
  );
});
