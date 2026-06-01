import assert from "node:assert/strict";
import { test } from "node:test";
import { HERMES_CREW } from "../config/hermes-crew.ts";
import type { KanbanTask } from "../types.ts";
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

test("builds crew dashboard with missing profile and channel attention", () => {
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
    tasks: [baseTask],
    notes: [],
    gateway: {
      gateway_state: "running",
      active_agents: 0,
      platforms: { discord: { state: "connected" }, webhook: { state: "connected" } },
    },
    nowMs: 1_700_000_060_000,
  });

  const incidents = dashboard.crew.find((profile) => profile.id === "refuelr-incidents");
  assert.equal(incidents?.status, "running");
  assert.equal(incidents?.runningTasks, 1);
  assert.equal(dashboard.stats.failedJobs, 1);
  assert.ok(dashboard.attention.some((item) => item.includes("refuelr-engineering profile is not created")));
  assert.ok(dashboard.attention.some((item) => item.includes("refuelr-weekly-social")));
});
