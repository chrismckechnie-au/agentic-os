import assert from "node:assert/strict";
import { test } from "node:test";
import { HERMES_CREW } from "../config/hermes-crew.ts";
import type { HermesCrewActionRecord, KanbanTask } from "../types.ts";
import { buildHermesCrewDashboard, ownerForJobName, statusFromCronJob } from "./crew-core.ts";

const baseTask: KanbanTask = {
  id: "t_1",
  title: "Investigate alert",
  status: "running",
  priority: 2,
  assignee: "refuelr-incidents",
  createdAt: "5m ago",
};

test("classifies cron jobs by last status and enabled state", () => {
  assert.equal(statusFromCronJob({ name: "ok", enabled: true, last_status: "ok" }), "completed");
  assert.equal(statusFromCronJob({ name: "bad", enabled: true, last_status: "error" }), "failed");
  assert.equal(statusFromCronJob({ name: "paused", enabled: false, last_status: "ok" }), "paused");
});

test("routes cron jobs to crew roles from operational keywords", () => {
  assert.equal(ownerForJobName("Refuelr alerts to Kanban tickets"), "incidents");
  assert.equal(ownerForJobName("refuelr-social-post-announcer"), "social");
  assert.equal(ownerForJobName("Refuelr workflow governance briefing"), "engineering");
});

test("builds ranked normalized crew issues and top issue summaries", () => {
  const channelNames = new Map<string, string>([
    ["hermes-requests", "1"],
    ["refuelr-alerts", "2"],
    ["hermes-incidents", "3"],
  ]);
  const dashboard = buildHermesCrewDashboard({
    hermesHome: "/home/chris/.hermes",
    activeProfile: "refuelrops",
    profiles: HERMES_CREW.map((def) => ({
      id: def.id,
      exists: def.id === "refuelrops" || def.id === "refuelr-incidents",
      home: `/home/chris/.hermes/profiles/${def.id}`,
      model: def.model,
      fallbackModel: def.fallbackModel,
      lastActivityMs: 1_700_000_000_000,
    })),
    channelNames,
    jobs: [
      {
        id: "job1",
        name: "refuelr-weekly-social",
        enabled: true,
        last_status: "error",
        last_error: "500",
      },
    ],
    tasks: [
      {
        ...baseTask,
        id: "blocked-1",
        title: "Fix broken imports",
        status: "blocked",
        priority: 3,
        body: "Awaiting handoff from Engineering",
      },
    ],
    notes: [],
    gateway: {
      gateway_state: "running",
      active_agents: 0,
      platforms: { discord: { state: "connected" }, webhook: { state: "connected" } },
    },
    nowMs: 1_700_000_060_000,
  });

  const incidents = dashboard.crew.find((profile) => profile.id === "refuelr-incidents");
  assert.equal(incidents?.status, "attention");
  assert.equal(incidents?.topIssueTitle, "Fix broken imports is blocked");
  assert.match(incidents?.prioritySummary ?? "", /critical/);
  assert.equal(dashboard.issues[0]?.type, "task");
  assert.equal(dashboard.issues[0]?.affectedObjects[0]?.kind, "task");
  assert.ok(dashboard.attention.some((item) => item.includes("Fix broken imports is blocked")));
  assert.ok(dashboard.attention.some((item) => item.includes("refuelr-weekly-social failed")));
  assert.equal(dashboard.stats.failedJobs, 1);
  assert.ok(dashboard.stats.activeIssues >= 3);
});

test("normalizes hyphenation drift when matching task owners to crew profiles", () => {
  const dashboard = buildHermesCrewDashboard({
    hermesHome: "/home/chris/.hermes",
    activeProfile: "refuelrops",
    profiles: HERMES_CREW.map((def) => ({
      id: def.id,
      exists: true,
      home: `/home/chris/.hermes/profiles/${def.id}`,
      model: def.model,
      fallbackModel: def.fallbackModel,
      lastActivityMs: 1_700_000_000_000,
    })),
    channelNames: new Map(HERMES_CREW.map((def) => [def.privateChannel, def.privateChannel])),
    jobs: [],
    tasks: [
      {
        ...baseTask,
        id: "drift-1",
        assignee: "refuelrops",
        status: "blocked",
      },
    ],
    notes: [],
    nowMs: 1_700_000_060_000,
  });

  const ops = dashboard.crew.find((profile) => profile.id === "refuelrops");
  assert.equal(ops?.topIssueId, "task:drift-1");
});

test("attaches recent operator action history to matching issues and profiles", () => {
  const actionHistory: HermesCrewActionRecord[] = [
    {
      id: "1",
      ts: new Date(1_700_000_060_000).toISOString(),
      when: "just now",
      actor: "agentic-os",
      profile: "refuelr-incidents",
      role: "incidents",
      issueId: "task:t_1",
      actionKind: "change_task_status",
      targetKind: "task",
      targetId: "t_1",
      outcome: "success",
      note: "Handed off",
      summary: "Moved task back to running",
    },
  ];
  const dashboard = buildHermesCrewDashboard({
    hermesHome: "/home/chris/.hermes",
    activeProfile: "refuelrops",
    profiles: HERMES_CREW.map((def) => ({
      id: def.id,
      exists: true,
      home: `/home/chris/.hermes/profiles/${def.id}`,
      model: def.model,
      fallbackModel: def.fallbackModel,
      lastActivityMs: 1_700_000_000_000,
    })),
    channelNames: new Map(HERMES_CREW.map((def) => [def.privateChannel, def.privateChannel])),
    jobs: [],
    tasks: [{ ...baseTask, status: "blocked" }],
    notes: [],
    actionHistory,
    nowMs: 1_700_000_060_000,
  });

  assert.equal(dashboard.actionHistory.length, 1);
  assert.equal(dashboard.issues.find((issue) => issue.id === "task:t_1")?.recentActions.length, 1);
  assert.equal(dashboard.crew.find((profile) => profile.id === "refuelr-incidents")?.recentActions.length, 1);
});

test("suppresses acknowledged mission-control events from active issues", () => {
  const dashboard = buildHermesCrewDashboard({
    hermesHome: "/home/chris/.hermes",
    activeProfile: "refuelrops",
    profiles: HERMES_CREW.map((def) => ({
      id: def.id,
      exists: true,
      home: `/home/chris/.hermes/profiles/${def.id}`,
      model: def.model,
      fallbackModel: def.fallbackModel,
      lastActivityMs: 1_700_000_000_000,
    })),
    channelNames: new Map(HERMES_CREW.map((def) => [def.privateChannel, def.privateChannel])),
    jobs: [],
    tasks: [],
    notes: [],
    loggedEvents: [
      {
        id: "evt-1",
        when: "just now",
        source: "mission-control",
        title: "Session failed",
        status: "failed",
        summary: "Needs acknowledgement",
      },
    ],
    ackedEventIds: new Set(["evt-1"]),
    nowMs: 1_700_000_060_000,
  });

  assert.equal(dashboard.activity.find((entry) => entry.id === "evt-1")?.acked, true);
  assert.equal(dashboard.issues.some((issue) => issue.id === "event:evt-1"), false);
});
