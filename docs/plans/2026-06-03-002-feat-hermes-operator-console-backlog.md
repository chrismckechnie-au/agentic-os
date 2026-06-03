---
title: "feat: Hermes operator console implementation backlog"
status: active
created: 2026-06-03
source_plan: docs/plans/2026-06-03-001-feat-hermes-operator-console-plan.md
owner: Hermes dashboard
backlog_depth: deep
---

# feat: Hermes operator console implementation backlog

## Summary

This backlog turns the corrected Hermes operator-console plan into an execution-ready phase sequence. It preserves the original dependency order—normalize the issue model first, then expose the read/audit substrate, then rebuild the worker-first UI, then layer in cross-worker triage and safe remediation flows.

The backlog is designed so each phase ends in a shippable checkpoint with concrete verification. File paths stay repo-relative and align to the corrected plan.

---

## Execution posture

- Prefer small, reviewable commits inside each phase.
- Keep the worker-first home surface intact at every intermediate checkpoint.
- Do not bypass existing Hermes CLI write bridges.
- Treat `src/lib/hermes/crew-core.test.ts` as the minimum regression anchor and widen Hermes test coverage only when a phase introduces behavior that can no longer fit cleanly there.
- Preserve the existing Hermes read route as the canonical refresh entry point; evolve its payload instead of creating parallel read APIs.

---

## Phase 0 — Baseline and contract capture

**Purpose:** Lock the current behavior and define the implementation guardrails before reshaping DTOs or UI state.

### Backlog items

1. **Capture the current Mission Control contract**
   - **Why:** U1-U6 all depend on a shared understanding of what the current Hermes dashboard emits and what must remain stable during the transition.
   - **Files to inspect:**
     - `src/lib/hermes/crew-core.ts`
     - `src/lib/hermes/crew.ts`
     - `src/app/api/hermes/crew/route.ts`
     - `src/components/hermes/mission-control.tsx`
     - `src/lib/types.ts`
   - **Deliverable:** A working notes section in the implementation branch or PR description covering:
     - current worker card fields
     - current `attention` usage
     - current mutation routes already available
     - current test entry points

2. **Define the target DTO seam before editing UI code**
   - **Why:** The drawer, All issues panel, and action/result states should all consume one normalized issue contract rather than inventing local shapes.
   - **Output to settle:**
     - worker summary shape
     - issue shape
     - affected-object reference shape
     - recommended action shape
     - audit/activity record shape
     - mutation result envelope shape

3. **Decide Hermes test-entry widening strategy**
   - **Why:** The plan expects new Hermes behaviors to remain verifiable without scattering unrun tests.
   - **Decision point:** either keep coverage in `src/lib/hermes/crew-core.test.ts` or widen the Hermes test script entry in `package.json` to include additional Hermes test files.

### Exit criteria

- The target issue/audit DTO shape is clear enough to implement without reworking client props twice.
- The execution branch has an explicit answer for how Hermes-specific tests will be discovered and run.

### Verification

- Existing Hermes tests run clean before any behavior changes.
- No new UI code has been introduced yet.

---

## Phase 1 — Foundation: issue normalization and audit substrate

**Maps to:** U1 + U2

**Purpose:** Create the normalized issue model and the durable read/audit contract that every later UI and action flow depends on.

### Backlog items

1. **Introduce first-class worker issue and affected-object types**
   - **Primary files:**
     - `src/lib/types.ts`
     - `src/lib/hermes/crew-core.ts`
     - `src/lib/hermes/crew.ts`
   - **Work:**
     - Replace flat `attention`-only thinking with structured issue records.
     - Add typed affected-object references for tasks, cron jobs, channels, sessions, config gaps, and mission-control events.
     - Add worker-level scorecard fields and top-issue summary fields derived from the same normalized source.

2. **Implement deterministic production-impact ranking**
   - **Primary files:**
     - `src/lib/hermes/crew-core.ts`
     - `src/lib/hermes/crew-core.test.ts`
   - **Work:**
     - Add a small, explicit ranking/scoring helper.
     - Rank by production/user impact first, then use stable tie-breakers.
     - Ensure ranking remains resilient when some signal sources are missing or stale.

3. **Refactor dashboard assembly around the normalized issue model**
   - **Primary files:**
     - `src/lib/hermes/crew.ts`
     - `src/lib/hermes/crew-core.ts`
   - **Work:**
     - Make the server-side dashboard builder emit worker issue collections, top issue summaries, and issue-linked placeholders for future activity/history.
     - Preserve any lightweight derived summary text only as convenience output, not as the source of truth.

4. **Upgrade the crew API to the new read contract**
   - **Primary files:**
     - `src/app/api/hermes/crew/route.ts`
     - `src/lib/types.ts`
   - **Work:**
     - Return the normalized dashboard DTO from the existing crew route.
     - Keep the route safe to poll after mutations.

5. **Add the operator-action audit substrate in mission-control storage**
   - **Primary files:**
     - `src/lib/hermes/mission-control-db.ts`
     - `src/app/api/hermes/crew/events/[id]/ack/route.ts`
     - `src/lib/types.ts`
   - **Work:**
     - Extend mission-control storage with an operator-action history table/store.
     - Record both success and failure outcomes.
     - Keep existing acknowledgement behavior compatible while feeding the shared audit story.

6. **Broaden Hermes regression coverage for the new contract**
   - **Primary files:**
     - `src/lib/hermes/crew-core.test.ts`
     - `package.json`
   - **Work:**
     - Add ranking, ownership, and missing-signal cases.
     - Widen the Hermes test entry if the new audit/read behavior needs separate files.

### Dependencies

- Depends on Phase 0 decisions only.

### Exit criteria

- The read route can fully answer: top issue, ranking rationale, affected objects, and recent action-history placeholders for every worker.
- Mission-control storage can persist and read operator-action audit records.
- Hermes tests cover mixed-signal ranking, ownership resolution, and audit persistence behavior.

### Verification

- Hermes read payload refreshes successfully from `src/app/api/hermes/crew/route.ts` with the new DTO shape.
- Ranking tests cover blocked task vs failed cron vs channel/config gaps.
- First-boot mission-control database creation still succeeds.

---

## Phase 2 — Primary operator surface: interactive worker-first Mission Control

**Maps to:** U3

**Purpose:** Replace the static card-only page with a server-seeded client experience while keeping the worker-first mental model compact and readable.

### Backlog items

1. **Split Mission Control into server-seeded shell plus client state owner**
   - **Primary files:**
     - `src/components/hermes/mission-control.tsx`
     - `src/components/hermes/mission-control-client.tsx`
     - `src/app/agents/[agent]/page.tsx`
   - **Work:**
     - Keep server-side initial data load.
     - Move selection, drawer open state, focused issue, and refresh state into a dedicated client component.

2. **Extract compact worker-card rendering**
   - **Primary files:**
     - `src/components/hermes/worker-card.tsx`
     - `src/components/hermes/mission-control-client.tsx`
   - **Work:**
     - Render status, open/running counts, priority summary, top issue title, and `View issues` CTA.
     - Ensure healthy workers still open a meaningful drawer.

3. **Build the worker drawer information architecture**
   - **Primary files:**
     - `src/components/hermes/worker-drawer.tsx`
     - `src/components/hermes/issue-detail.tsx`
   - **Work:**
     - Render the drawer in the required order: Overview, Issues, Activity, Actions.
     - Show plain-English explanations before raw detail.
     - Group issue evidence by cause type and severity.
     - Add a sticky recommended-action affordance without turning the page into a noisy action wall.

4. **Wire client refresh and reranking after mutations**
   - **Primary files:**
     - `src/components/hermes/mission-control-client.tsx`
     - `src/components/hermes/worker-drawer.tsx`
   - **Work:**
     - Refresh via the normalized crew API.
     - Preserve selected worker context after successful or failed mutations.
     - Show human-readable failure banners with expandable detail.

### Dependencies

- Depends on Phase 1.

### Exit criteria

- Worker cards remain compact and actionable.
- Clicking any worker opens a structured drawer, including healthy workers.
- The drawer renders Overview → Issues → Activity → Actions in the required order.

### Verification

- Manual UI verification confirms top-issue summaries map to normalized data.
- Refresh after mocked or real mutation responses preserves worker context.
- Failure-state rendering shows plain-English summary before raw detail.

---

## Phase 3 — Cross-worker triage surface

**Maps to:** U4

**Purpose:** Add the secondary All issues workflow without replacing the worker-first home surface.

### Backlog items

1. **Add the All issues entry point and panel shell**
   - **Primary files:**
     - `src/components/hermes/mission-control-client.tsx`
     - `src/components/hermes/all-issues-panel.tsx`
   - **Work:**
     - Place the global entry point above the worker cards.
     - Keep the worker-card grid as the primary home surface.

2. **Implement severity-grouped, production-impact-sorted issue listing**
   - **Primary files:**
     - `src/components/hermes/all-issues-panel.tsx`
     - `src/lib/types.ts`
   - **Work:**
     - Group by severity.
     - Sort by production impact.
     - Show worker lane and issue type as the row’s secondary context.

3. **Add filter and search controls over normalized issue data**
   - **Primary files:**
     - `src/components/hermes/issue-filters.tsx`
     - `src/components/hermes/mission-control-client.tsx`
   - **Work:**
     - Add default filters for severity, worker lane, and issue type.
     - Add text search across titles, summaries, and related object names.

4. **Reuse the worker drawer as the issue detail target**
   - **Primary files:**
     - `src/components/hermes/mission-control-client.tsx`
     - `src/components/hermes/worker-drawer.tsx`
   - **Work:**
     - Opening an item from All issues should focus the existing worker drawer on that issue.
     - Swapping issue focus must not leave stale drawer content behind.

5. **Add the All issues bulk-selection shell**
   - **Primary files:**
     - `src/components/hermes/all-issues-panel.tsx`
   - **Work:**
     - Introduce panel-scoped multi-select and sticky bulk-action affordances that will later be wired to safe bulk mutations in Phase 4.

### Dependencies

- Depends on Phase 2.

### Exit criteria

- Operators can review a grouped global issue queue while still returning naturally to worker-first drill-down.
- Filters and search operate on normalized DTO fields instead of bespoke UI-only heuristics.

### Verification

- Global issue list groups and sorts correctly with mixed worker data.
- Search/filter combinations update visible groups consistently.
- Selecting an issue focuses the correct worker drawer and issue context.

---

## Phase 4 — Safe task workflows and bulk note-enforced transitions

**Maps to:** U5

**Purpose:** Bring task mutation flows and bulk transitions up to the v1 safety contract before adding the remaining non-task remediation actions.

### Backlog items

1. **Tighten task mutation request contracts**
   - **Primary files:**
     - `src/app/api/hermes/kanban/tasks/[id]/route.ts`
     - `src/lib/hermes/kanban-write.ts`
   - **Work:**
     - Require note/handoff payloads for status changes and reassignment.
     - Keep the Hermes CLI transition bridge as the final authority.

2. **Add operator-friendly status/action translation**
   - **Primary files:**
     - `src/app/api/hermes/kanban/tasks/[id]/route.ts`
     - `src/components/hermes/worker-drawer.tsx`
   - **Work:**
     - Map dashboard language to CLI/state-machine transitions cleanly.
     - Avoid leaking raw Hermes verbs into the operator UI.

3. **Restrict reassignment to known worker lanes**
   - **Primary files:**
     - `src/app/api/hermes/kanban/tasks/[id]/route.ts`
     - `src/components/hermes/worker-drawer.tsx`
   - **Work:**
     - Enforce valid lane choices both client-side and server-side.

4. **Add destructive/disruptive action confirmation UX**
   - **Primary files:**
     - `src/components/hermes/worker-drawer.tsx`
     - `src/components/hermes/all-issues-panel.tsx`
   - **Work:**
     - Require explicit confirmation that names the exact object and side effects before applying risky actions.

5. **Wire bulk status changes with one shared required note**
   - **Primary files:**
     - `src/app/api/hermes/kanban/bulk/route.ts`
     - `src/lib/hermes/kanban-write.ts`
     - `src/components/hermes/all-issues-panel.tsx`
     - `src/components/kanban/hermes-kanban.tsx`
   - **Work:**
     - Accept only compatible selections.
     - Apply one shared note/handoff.
     - Record resulting action history.

6. **Standardize the mutation result envelope**
   - **Primary files:**
     - `src/app/api/hermes/kanban/tasks/[id]/route.ts`
     - `src/app/api/hermes/kanban/bulk/route.ts`
     - `src/lib/types.ts`
   - **Work:**
     - Return success/failure, human summary, raw detail, audit id, and refresh hints using one shared shape.

### Dependencies

- Depends on Phase 3 for the All issues selection shell and worker-drawer action surface.

### Exit criteria

- Task and bulk mutations require note/handoff context.
- Invalid reassignment and incompatible bulk selections are rejected before any write is applied.
- Successful and failed task/bulk mutations both feed the operator audit trail.

### Verification

- Task reassignment plus status change requires note/handoff and confirmation.
- Bulk status change rejects empty or incompatible selections.
- CLI transition failures preserve operator-entered context and return a clear failure summary.

---

## Phase 5 — Non-task remediation: cron, session, and config-gap actions

**Maps to:** U6

**Purpose:** Complete the v1 operator loop so non-task issues can be investigated and acted on from the same drawer.

### Backlog items

1. **Expose safe cron action controls in issue detail**
   - **Primary files:**
     - `src/lib/hermes/cron-actions.ts`
     - `src/app/api/hermes/cron/[id]/[action]/route.ts`
     - `src/components/hermes/worker-drawer.tsx`
   - **Work:**
     - Support run now, pause, resume, and raw-log/error access.
     - Keep plain-English failure summaries ahead of raw detail.

2. **Wire session open/resume flows with preserved context**
   - **Primary files:**
     - `src/components/agent/session-workspace.tsx`
     - `src/components/hermes/worker-drawer.tsx`
   - **Work:**
     - Reuse existing session-opening behavior.
     - Preserve worker/task/issue context when launching into a session.

3. **Add read-only config-gap remediation cards**
   - **Primary files:**
     - `src/components/hermes/worker-drawer.tsx`
     - `src/lib/types.ts`
   - **Work:**
     - Show expected vs observed state.
     - Link operators to the smallest useful remediation context without adding direct editing.

4. **Feed non-task actions into the shared audit and refresh loop**
   - **Primary files:**
     - `src/components/hermes/worker-drawer.tsx`
     - `src/lib/hermes/mission-control-db.ts`
     - `src/app/api/hermes/crew/route.ts`
   - **Work:**
     - Record cron/session action outcomes.
     - Refresh the worker drawer and rerank remaining issues after action completion.

### Dependencies

- Depends on Phase 4.

### Exit criteria

- Cron-backed, session-linked, and config-gap issues all have actionable, non-dead-end drawer behavior.
- Non-task actions share the same failure-summary, audit-trail, and reranking semantics as task flows.

### Verification

- Cron issue details show human summary first and safe action buttons.
- Session-linked issues launch with preserved context.
- Failed cron actions do not falsely mark the issue resolved.

---

## Cross-phase watchpoints

- **DTO drift risk:** do not let All issues, worker drawer, and mutation envelopes fork into slightly different issue/action shapes.
- **Ranking churn risk:** keep the scoring model explicit and stable until the UI is proven; avoid “smart” heuristics during the first implementation pass.
- **Safety regression risk:** never let UI convenience bypass Hermes CLI validation or mission-control audit recording.
- **Noise risk:** keep worker cards compact even as drawer depth grows.
- **Test discoverability risk:** if Hermes coverage spreads past one file, update the package test entry immediately rather than leaving tests unrun.

---

## Recommended implementation order

1. Phase 0 — Baseline and contract capture
2. Phase 1 — Foundation: issue normalization and audit substrate
3. Phase 2 — Primary operator surface
4. Phase 3 — Cross-worker triage
5. Phase 4 — Safe task and bulk workflows
6. Phase 5 — Non-task remediation

This keeps data-model churn ahead of UI churn, and keeps write safety ahead of the broadest remediation surface.

---

## Definition of done

The backlog is complete when the Hermes page behaves as a worker-first operator console with:
- compact worker cards driven by normalized issue ranking
- a drawer that explains worker health in plain English and supports action follow-through
- an All issues surface for cross-worker triage and bulk status transitions
- safe task, cron, session, and config-gap remediation flows
- post-action reranking plus operator audit history for every write path
