import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
  ackMissionControlEvent,
  readMissionControlActionHistory,
  readMissionControlAcks,
  recordMissionControlAction,
} from "./mission-control-db.ts";

let tmpDir = "";
let dbPath = "";
const priorEnv = process.env.AGENTIC_ENABLE_HERMES_CREW_ACTIONS;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-mission-control-"));
  dbPath = path.join(tmpDir, "activity.db");
  process.env.AGENTIC_ENABLE_HERMES_CREW_ACTIONS = "1";
});

afterEach(() => {
  if (priorEnv === undefined) delete process.env.AGENTIC_ENABLE_HERMES_CREW_ACTIONS;
  else process.env.AGENTIC_ENABLE_HERMES_CREW_ACTIONS = priorEnv;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("records operator actions in mission-control storage", () => {
  const result = recordMissionControlAction(
    {
      actor: "agentic-os",
      profile: "refuelr-incidents",
      role: "incidents",
      issueId: "task:t_1",
      requestId: "req-1",
      actionKind: "change_task_status",
      targetKind: "task",
      targetId: "t_1",
      outcome: "success",
      note: "Handed off to Engineering",
      summary: "Moved task to in progress",
      detail: "Transitioned from blocked",
    },
    dbPath,
  );

  assert.equal(result.ok, true);
  const history = readMissionControlActionHistory(dbPath);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.issueId, "task:t_1");
  assert.equal(history[0]?.requestId, "req-1");
  assert.equal(history[0]?.outcome, "success");
});

test("acknowledging an event also writes operator action history", () => {
  const result = ackMissionControlEvent("evt_1", "Checked and acknowledged", dbPath, "agentic-os");
  assert.equal(result.ok, true);

  const acked = readMissionControlAcks(dbPath);
  assert.equal(acked.has("evt_1"), true);

  const history = readMissionControlActionHistory(dbPath);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.actionKind, "ack_event");
  assert.equal(history[0]?.targetKind, "event");
  assert.equal(history[0]?.targetId, "evt_1");
});
