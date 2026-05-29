// Seed a faithful Hermes kanban.db for local development / demo.
//
// Schema mirrors hermes_cli/kanban_db.py `tasks` table (+ a task_links table for
// dependencies). On the real Ubuntu box this file is created by Hermes itself —
// here we generate one so the live SQLite reader can be proven end-to-end.
//
// Usage:
//   node scripts/seed-kanban-db.mjs            # writes ~/.hermes/kanban.db
//   node scripts/seed-kanban-db.mjs <path>     # writes a custom path
//   HERMES_KANBAN_DB=/x/y.db node scripts/seed-kanban-db.mjs

import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const dbPath =
  process.argv[2] || process.env.HERMES_KANBAN_DB || path.join(os.homedir(), ".hermes", "kanban.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.rmSync(dbPath, { force: true });

const db = new DatabaseSync(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
    id                   TEXT PRIMARY KEY,
    title                TEXT NOT NULL,
    body                 TEXT,
    assignee             TEXT,
    status               TEXT NOT NULL,
    priority             INTEGER DEFAULT 0,
    created_by           TEXT,
    created_at           INTEGER NOT NULL,
    started_at           INTEGER,
    completed_at         INTEGER,
    workspace_kind       TEXT NOT NULL DEFAULT 'scratch',
    workspace_path       TEXT,
    branch_name          TEXT,
    claim_lock           TEXT,
    claim_expires        INTEGER,
    tenant               TEXT,
    result               TEXT,
    idempotency_key      TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    worker_pid           INTEGER,
    last_failure_error   TEXT,
    max_runtime_seconds  INTEGER,
    last_heartbeat_at    INTEGER,
    current_run_id       INTEGER,
    workflow_template_id TEXT,
    current_step_key     TEXT,
    skills               TEXT,
    model_override       TEXT,
    max_retries          INTEGER,
    session_id           TEXT
);

CREATE TABLE IF NOT EXISTS task_links (
    parent_id TEXT NOT NULL,
    child_id  TEXT NOT NULL,
    link_type TEXT NOT NULL DEFAULT 'depends_on'
);
`);

const now = Math.floor(Date.now() / 1000);
const minsAgo = (m) => now - m * 60;
const hrsAgo = (h) => now - h * 3600;
const daysAgo = (d) => now - d * 86400;
const J = (arr) => JSON.stringify(arr);

/** [id, title, body, assignee, status, priority, created_at, started_at, completed_at, workspace_kind, branch_name, skills, consecutive_failures] */
const rows = [
  ["T-142", "Investigate intermittent 502s on /checkout", "Decompose from incident goal; reproduce and isolate failing dependency.", null, "triage", 3, minsAgo(4), null, null, "scratch", null, null, 0],
  ["T-141", "Summarize competitor pricing changes", "From weekly research routine. Needs scope + sources.", null, "triage", 1, minsAgo(22), null, null, "scratch", null, J(["web-researcher"]), 0],
  ["T-138", "Add composite index to events table", "perf-profiler flagged seq scans on (tenant, created_at).", null, "todo", 2, hrsAgo(1), null, null, "repo", null, J(["sql-analyzer"]), 0],
  ["T-137", "Draft Q2 marketing recap", null, null, "todo", 1, hrsAgo(1), null, null, "scratch", null, J(["report-writer"]), 0],
  ["T-135", "Backfill embeddings for archived notes", "1,284 notes; batch in chunks of 200.", null, "todo", 0, hrsAgo(2), null, null, "scratch", null, null, 0],
  ["T-131", "Nightly database backup verification", null, null, "scheduled", 2, hrsAgo(3), null, null, "scratch", "ops/backup-verify", J(["sql-analyzer"]), 0],
  ["T-129", "Weekly dependency audit", null, null, "scheduled", 1, hrsAgo(5), null, null, "scratch", null, null, 0],
  ["T-126", "Optimize orders pagination query", "Rewrite with window function; target <200ms p95.", null, "ready", 3, minsAgo(26), null, null, "repo", "feat/orders-pagination", J(["query-optimizer", "perf-profiler"]), 0],
  ["T-124", "Generate API docs from OpenAPI spec", null, null, "ready", 1, minsAgo(40), null, null, "scratch", null, J(["report-writer"]), 0],
  ["T-120", "Optimize database query performance", "6-step job: collect logs -> analyze -> recommend -> validate -> benchmark -> report.", "worker-1", "running", 3, minsAgo(18), minsAgo(12), null, "repo", "feat/query-optimizations", J(["sql-analyzer", "query-optimizer"]), 0],
  ["T-118", "Crawl + classify competitor changelogs", null, "worker-2", "running", 2, minsAgo(30), minsAgo(9), null, "scratch", null, J(["web-researcher"]), 0],
  ["T-117", "Build onboarding flow v2 spec", null, "swarm-a", "running", 1, minsAgo(35), minsAgo(2), null, "scratch", null, null, 0],
  ["T-114", "Migrate auth tokens to new schema", "Blocked on T-138 (index) and a migration approval.", null, "blocked", 3, hrsAgo(2), null, null, "repo", "chore/token-migration", J(["sql-analyzer"]), 0],
  ["T-112", "Sync Slack notifications integration", "Gateway credentials missing.", "worker-3", "blocked", 1, hrsAgo(3), null, null, "scratch", null, null, 2],
  ["T-108", "Rate limiting middleware", "Implemented token bucket; needs review before merge.", null, "review", 2, hrsAgo(3), hrsAgo(2), minsAgo(20), "repo", "feat/rate-limit", J(["query-optimizer"]), 0],
  ["T-106", "Docs content audit", null, null, "review", 0, hrsAgo(5), hrsAgo(4), hrsAgo(1), "scratch", null, J(["report-writer"]), 0],
  ["T-101", "Daily ops summary report", null, null, "done", 1, daysAgo(1), daysAgo(1), hrsAgo(6), "scratch", null, J(["report-writer"]), 0],
  ["T-099", "SLA breach postmortem", null, null, "done", 2, daysAgo(1), daysAgo(1), daysAgo(1), "scratch", null, J(["web-researcher", "report-writer"]), 0],
  ["T-097", "Add missing indexes (7)", null, null, "done", 3, daysAgo(2), daysAgo(2), daysAgo(1), "repo", "perf/indexes", J(["sql-analyzer"]), 0],
  ["T-080", "One-off data export for finance", null, null, "archived", 0, daysAgo(7), daysAgo(7), daysAgo(6), "scratch", null, null, 0],
];

const insert = db.prepare(`
  INSERT INTO tasks
    (id, title, body, assignee, status, priority, created_by, created_at, started_at,
     completed_at, workspace_kind, branch_name, skills, consecutive_failures)
  VALUES (?, ?, ?, ?, ?, ?, 'hermes', ?, ?, ?, ?, ?, ?, ?)
`);
for (const r of rows) {
  insert.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12]);
}

// Dependencies (parent -> child): give a couple of tasks deps so the board shows them.
const link = db.prepare(`INSERT INTO task_links (parent_id, child_id) VALUES (?, ?)`);
link.run("T-138", "T-126"); // pagination work depends on the index
link.run("T-138", "T-114"); // token migration depends on the index
link.run("T-097", "T-114"); // and on the missing-indexes work
link.run("T-108", "T-126"); // pagination depends on rate-limit groundwork

const count = db.prepare("SELECT COUNT(*) AS n FROM tasks").get();
db.close();

console.log(`Seeded ${count.n} tasks into ${dbPath}`);
