---
title: "feat: Hermes operator console"
status: active
created: 2026-06-03
source: docs/brainstorms/2026-06-03-hermes-dashboard-operator-console-requirements.md
owner: Hermes dashboard
plan_depth: deep
---

# feat: Hermes operator console

## Summary

Implement the next iteration of the Agentic OS Hermes page as a worker-first operator console that keeps the existing card-based entry point, adds issue normalization and production-impact ranking, and introduces a drawer-driven remediation flow with safe task, cron, session, and config actions. The plan covers both single-worker drill-down and the new All issues bulk-triage surface defined in the origin requirements document.

This plan keeps the current live-Hermes data path and write bridges, but restructures how that data is shaped and presented so operators can understand why Refuelr Ops or Incidents is flagged, inspect the exact affected objects, and act without leaving the dashboard. It also adds the minimum auditability and confirmation model required for safe in-dashboard mutations.

---

## Problem Frame

The current Hermes Mission Control surface is informative but shallow. `src/lib/hermes/crew-core.ts` currently reduces worker health to profile availability, missing private channels, failed cron jobs, and a small set of task states; `src/components/hermes/mission-control.tsx` renders that snapshot as static cards plus a generic Attention list. The deeper Kanban and session controls already exist elsewhere in the workspace, but they are disconnected from the worker cards, which means the operator must infer root cause and manually pivot into other tabs to act.

The origin requirements document defines a different target shape: a worker-first operator console with cards that summarize the top issue, a drawer that explains the cause in plain English and groups affected objects by severity, a global All issues surface for cross-worker triage, and guarded actions for task, cron, session, and channel/config workflows. This plan translates that product direction into a concrete implementation sequence while preserving the live Hermes data model and existing write invariants.

---

## Requirements Trace

**Origin document:** `docs/brainstorms/2026-06-03-hermes-dashboard-operator-console-requirements.md`

The implementation must preserve all origin requirements, especially:
- Worker-first information architecture and compact worker cards (R1-R5)
- Worker drawer header, overview, issue ordering, and recommended-action model (R6-R15)
- Safe v1 actions for tasks, cron jobs, sessions, and config gaps (R16-R21)
- Global All issues view with severity grouping, production-impact sorting, filtering, and bulk transitions (R22-R29)
- Post-action refresh, failure summaries, and operator audit trail (R30-R32)

The plan also keeps the origin actor model (operator, worker lane owner, Hermes automation system), the three key flows (worker-first triage, bulk triage, guided issue resolution), and the acceptance examples around blocked tasks, cron failures, channel gaps, and bulk transitions.

---

## Current-State Findings

### Existing strengths to preserve
- `src/lib/hermes/crew.ts` already assembles a live dashboard payload from Hermes profile files, cron state, Kanban tasks, Obsidian notes, and mission-control events.
- `src/app/api/hermes/crew/route.ts` already exposes a Hermes crew read endpoint, so the client-refresh problem is primarily a contract-evolution problem rather than a missing-route problem.
- `src/lib/hermes/kanban-write.ts` already provides a guarded write bridge through the Hermes CLI for single-task transitions, comments, assignment, links, bulk transitions, and dispatch.
- `src/lib/hermes/cron-actions.ts` already supports the safe cron operations needed for v1 (`run`, `pause`, `resume`).
- `src/components/kanban/hermes-kanban.tsx` already demonstrates the app’s preferred interaction style for task drawers, create-task modals, fixed-position bulk actions, and mutation toasts.
- `src/components/agent/session-workspace.tsx` already knows how to open Hermes chat sessions from dashboard-adjacent surfaces.

### Gaps this plan must close
- `src/lib/hermes/crew-core.ts` produces worker summaries, but not an explicit issue model, production-impact ranking, or affected-object list.
- `src/components/hermes/mission-control.tsx` is static and card-only: no drawer, no All issues surface, no action routing, and no explanation-first layout.
- The existing Hermes crew read route still returns a profile-centric dashboard shape; it does not yet provide stable issue IDs, typed affected-object references, recommended-action metadata, or a worker-scoped issue history model that can support the planned drawer and All issues UX.
- Bulk status changes currently exist in Kanban, but they do not enforce the note/handoff requirement defined in the origin requirements.
- The current mission-control persistence layer stores events and acknowledgements, but not a dedicated operator-action audit trail that can be shown back in the drawer.
- Session-aware issue handling is not yet sourced into the worker issue model, so open/resume flows would currently lose too much triage context.

---

## Key Technical Decisions

1. **Introduce a first-class crew issue model instead of deriving UI state directly from profile cards.**
   Create a normalization layer that turns live Hermes signals into ranked issue records with severity, production-impact score, issue type, affected object references, recommended action metadata, and plain-English summaries. This becomes the common source for worker cards, worker drawers, and All issues. (see origin: `docs/brainstorms/2026-06-03-hermes-dashboard-operator-console-requirements.md`)

2. **Keep worker cards server-seeded, but evolve the existing crew API into the canonical client refresh contract.**
   The server-rendered page remains the initial data source for fast load and parity with current behavior, while `src/app/api/hermes/crew/route.ts` is upgraded to return the normalized dashboard DTO needed for drawer refresh, post-action reranking, and lightweight polling.

3. **Reuse existing Hermes write bridges rather than inventing direct database writes.**
   Task and cron actions continue to flow through the existing Hermes CLI-backed adapters. New requirements like mandatory handoff notes and richer action semantics should be enforced in the dashboard and route layer without bypassing the CLI state machine.

4. **Persist operator-action history in mission-control storage, not in ad hoc UI state.**
   Extend `mission-control/activity.db` with an operator-action audit table and helper methods so status changes, reassignments, cron actions, acknowledgements, and guided remediation notes are queryable and can feed Activity / issue history views. The stored record must capture actor, target type/id, origin worker/issue context, note/handoff content, outcome (`success` or `failure`), plain-English summary, raw detail/error, and a request/correlation identifier.

5. **Implement the drawer and All issues surface as Hermes-specific client components, not by overloading the generic Kanban UI.**
   The existing `HermesKanban` drawer remains a task-focused tool. The Hermes worker drawer needs a different information architecture: issue-first, multi-object, cross-signal, and recommendation-driven.

---

## System-Wide Impact

### Live Hermes DTOs
The Hermes dashboard payload will grow from profile-centric summaries into a richer issue-aware contract. This impacts `src/lib/types.ts`, `src/lib/hermes/crew-core.ts`, `src/lib/hermes/crew.ts`, the existing crew read API route, and the Hermes page components.

### Write semantics and operator safety
The task and cron routes will need stricter validation and new request shapes for required notes, reassignment restrictions, and post-action audit recording. This touches the Hermes-specific API routes and the server-only write helpers.

### Mission-control persistence
Adding audit history changes the role of `src/lib/hermes/mission-control-db.ts` from acknowledgment storage to a broader operator-history substrate. The plan must preserve current ack behavior while adding action history safely.

### Testing surface
The current Hermes test script only runs `src/lib/hermes/crew-core.test.ts`. This work expands Hermes logic enough that the Hermes test entry should either absorb more cases into that file or be widened to include additional Hermes test files.

---

## Implementation Units

### U1. Normalize Hermes signals into ranked worker issues
**Goal:** Convert the existing live Hermes data into a first-class issue model that can power card summaries, worker drawers, and All issues.

**Requirements:** R2-R15, R22-R27, F1, F2, F3, AE1, AE2, AE3, AE6

**Dependencies:** None

**Files:**
- `src/lib/types.ts`
- `src/lib/hermes/crew-core.ts`
- `src/lib/hermes/crew.ts`
- `src/lib/hermes/crew-core.test.ts`
- `package.json`

**Approach:**
- Normalize ownership before ranking by preferring explicit profile/channel mappings and only falling back to name-based heuristics when necessary, so jobs and issues land on the correct worker lane.
- Extend the Hermes DTOs with explicit worker issue and affected-object types, including fields for issue id, worker/profile, severity, production-impact ranking, issue type, plain-English summary, linked objects, recommended action metadata, and object-specific details.
- Refactor `buildHermesCrewDashboard` so it no longer only emits `attention: string[]`; instead it should compute worker-level issue collections and top-issue summaries from tasks, failed cron jobs, missing profile/channel signals, and mission-control events.
- Introduce typed affected-object references for at least tasks, cron jobs, channels, sessions, config gaps, and mission-control events so All issues and worker drawers can share the same contract.
- Add a production-impact scoring helper that prefers customer-facing / operationally blocking issues over cosmetic gaps, while still preserving a deterministic sort order.
- Derive per-worker scorecard metrics from the same normalized issue set so worker cards and drawer overview stay consistent.
- Replace the single `attention` string list with structured data; preserve a lightweight text summary only as a derived convenience field if the top page still needs it.
- Add issue-linked activity/history placeholders in the DTO now so later action history and reranking work do not require a second schema reshape.
- Widen the Hermes test entry if needed so new Hermes-specific tests can run without being orphaned.

**Patterns to follow:**
- `src/lib/hermes/crew-core.test.ts` for node:test coverage style
- `src/lib/hermes/crew.ts` for server-only DTO assembly
- `src/lib/types.ts` for domain-first UI contracts

**Test scenarios:**
- Covers AE1. Given a worker with one blocked task and two failed cron jobs, the normalized worker summary picks the highest-production-impact issue as the card title and reports counts plus priority summary consistently.
- Covers AE2. Given a worker with no active flags but valid profile metadata, the normalized payload still includes enough role and scorecard information for a healthy drawer overview.
- Covers AE3. Given signals from a blocked task, failed cron job, and missing private channel, the normalization logic emits separate issue types with correct severity ordering and object linkage.
- Given multiple medium-impact issues with identical severity, ranking remains deterministic and stable across refreshes.
- Given stale or missing mission-control event history, the issue model still renders from task / cron / channel data without crashing.
- Given channel naming drift (`refuelrops` vs `refuelr-ops` style mismatches), profile resolution still produces the correct worker issue ownership.

**Verification:**
- The Hermes dashboard payload can answer, for every worker, “what is the top issue, why is it ranked first, and which objects are involved?” without extra client inference.
- Hermes normalization tests cover mixed-signal ranking and no longer rely on the old flat attention-only output.

### U2. Evolve the Hermes crew API and add an operator-action audit substrate
**Goal:** Support client-side refresh, post-mutation reranking, and durable operator-action history.

**Requirements:** R18-R21, R30-R32, F2, F3, AE4, AE5, AE8

**Dependencies:** U1

**Files:**
- `src/app/api/hermes/crew/route.ts`
- `src/lib/hermes/mission-control-db.ts`
- `src/app/api/hermes/crew/events/[id]/ack/route.ts`
- `src/lib/types.ts`
- `src/lib/hermes/crew-core.test.ts`

**Approach:**
- Upgrade the existing Hermes crew read route so it returns the normalized Hermes dashboard DTO for client-side refresh after actions and for lightweight polling.
- Extend mission-control persistence with a dedicated operator-action table (or equivalently structured store) that records actor, timestamp, target object, action kind, resulting status, origin worker/issue context, note/handoff content, a plain-English summary, raw detail/error, and a request/correlation identifier.
- Add helper methods to write action records and read recent action history back into the dashboard payload so the worker drawer can show recent operator notes and action history.
- Keep acknowledgment writes compatible with existing event ack behavior while bringing them into the same operator-history story.
- Record both successful and failed action attempts; avoid misleading success history, but do preserve failed attempts as first-class audit records.
- Decide the minimal returned DTO for audit records now so the UI does not need later schema churn for Action History / Activity sections.

**Patterns to follow:**
- `src/lib/hermes/mission-control-db.ts` for SQLite lifecycle and schema management
- `src/app/api/hermes/crew/events/[id]/ack/route.ts` for Hermes action route conventions
- `src/app/api/hermes/kanban/board/route.ts` style for simple JSON read endpoints

**Test scenarios:**
- Covers AE8. Given a successful dashboard action, an operator-action record is stored with actor, timestamp, target object, action type, and note.
- Given a failed dashboard action, the failure summary is preserved without creating a misleading success audit record.
- Given repeated acknowledgements of the same mission-control event, ack behavior remains idempotent enough for the UI and does not corrupt action history.
- Given the mission-control database does not yet exist, schema creation succeeds and the new read/write helpers degrade gracefully on first boot.
- Given `AGENTIC_ENABLE_HERMES_CREW_ACTIONS` is off, the crew read route still works while write paths continue to return disabled-state responses.

**Verification:**
- The Hermes page can fetch fresh worker data without a full page reload.
- Operator actions and notes are queryable from mission-control storage and can be surfaced back into the UI.

### U3. Rebuild Mission Control as an interactive worker-first client surface
**Goal:** Replace the current static Mission Control card grid with an interactive client experience that preserves compact cards while opening a structured worker drawer.

**Requirements:** R1-R15, R30-R31, F1, F3, AE1, AE2, AE3, AE5

**Dependencies:** U1, U2

**Files:**
- `src/components/hermes/mission-control.tsx`
- `src/components/hermes/mission-control-client.tsx`
- `src/components/hermes/worker-card.tsx`
- `src/components/hermes/worker-drawer.tsx`
- `src/components/hermes/issue-detail.tsx`
- `src/app/agents/[agent]/page.tsx`

**Approach:**
- Convert the Hermes Mission Control surface into a server-seeded client component so worker selection, drawer state, and post-action refresh happen locally.
- Keep the new operator console scoped inside the existing Hermes Crew tab rather than reshaping `SessionWorkspace` ownership; `SessionWorkspace` should only gain narrow integration hooks if required.
- Keep cards compact: status, counts, priority summary, top issue title, and `View issues` CTA.
- Build a worker drawer with the agreed section order: Overview, Issues, Activity, Actions.
- Render the drawer header with status, role, private channel, and model, and use the current-state scorecard in Overview.
- In Issues, show the plain-English cause first, then severity-grouped affected objects, then action blocks, raw detail, recent activity, and note/handoff history.
- Use the existing app modal/drawer pattern from `HermesKanban` rather than introducing a new UI library abstraction, but do not inherit the global viewport-fixed bulk-action bar pattern directly into Mission Control.
- Ensure workers with no flags still open an informative drawer rather than a dead end.
- Make `mission-control-client.tsx` the state owner for selected worker, selected issue, drawer open state, All issues filter/search state, and mutation/refresh status.
- Add a sticky recommended-action affordance in the drawer so the Actions section can remain last without burying the primary CTA.

**Patterns to follow:**
- `src/components/kanban/hermes-kanban.tsx` for in-app drawer, modal, toast, and fixed action-bar patterns
- `src/components/agent/session-workspace.tsx` for Hermes-specific tab integration
- `src/components/hermes/mission-control.tsx` for current stat-card layout and Hermes branding

**Test scenarios:**
- Covers AE1. A flagged worker card shows a top issue title and CTA without expanding the card into a noisy diagnostic block.
- Covers AE2. Clicking a healthy worker still opens a drawer with Overview, Issues, Activity, and Actions sections populated from normalized data.
- Covers AE3. A worker with multiple root-cause types shows separate issue groupings rather than one merged blob.
- Covers AE5. A failed cron issue shows its plain-English explanation before raw error content in the drawer.
- Given a refresh after a successful action, the worker drawer reranks remaining issues without losing the current worker context.
- Given a failed action response, the drawer shows a plain-English failure banner with expandable raw detail rather than silently failing.

**Verification:**
- The Hermes page becomes actionable from the worker cards themselves, with no required pivot into the Kanban tab to start triage.
- The drawer renders the agreed section order and keeps the card surface compact.

### U4. Add the global All issues triage surface and cross-worker search/filtering
**Goal:** Implement the secondary cross-worker issue queue above the worker cards without replacing the worker-first mental model.

**Requirements:** R22-R29, F2, AE6, AE7

**Dependencies:** U1, U3

**Files:**
- `src/components/hermes/mission-control-client.tsx`
- `src/components/hermes/all-issues-panel.tsx`
- `src/components/hermes/issue-filters.tsx`
- `src/lib/types.ts`

**Approach:**
- Add a global `All issues` entry point above the worker cards.
- Render a severity-grouped, production-impact-sorted issue list using the normalized issue DTO from U1.
- Add default filters for severity, worker lane, and issue type, plus text search over titles, summaries, and related object names.
- Reuse the worker drawer as the detail target when an issue row is opened, focusing the drawer on the relevant issue instead of inventing a separate detail route.
- Add compatible bulk status selection mechanics that can coexist with the note requirement introduced in U5.
- Use a panel-scoped sticky bulk-action surface for All issues rather than reusing the viewport-fixed Kanban bulk bar unchanged.

**Patterns to follow:**
- `src/components/kanban/hermes-kanban.tsx` multi-select and bulk-action affordances
- Existing dashboard filter/input styling from the workspace components

**Test scenarios:**
- Covers AE6. Given issues across multiple workers, the All issues view groups by severity, sorts by production impact, and opens the correct worker drawer when an issue is selected.
- Covers AE7. Given a filter combination and text query, only matching issues remain visible and the grouping headers update consistently.
- Given issues with the same severity but different production-impact scores, the higher-impact issue appears first.
- Given no active issues, the view shows a usable empty state rather than an empty list shell.
- Given a drawer is already open, selecting a different All issues row swaps focus without leaving stale issue content on screen.

**Verification:**
- Operators can triage across workers without abandoning the worker-first home surface.
- Search and filters operate on the normalized issue model rather than bespoke per-component heuristics.

### U5. Enforce safe v1 task and bulk workflows with required handoff notes
**Goal:** Bring task actions and bulk transitions up to the v1 safety contract defined in the requirements.

**Requirements:** R16, R20-R21, R28-R32, F2, F3, AE4, AE7, AE8

**Dependencies:** U2, U3

**Files:**
- `src/app/api/hermes/kanban/tasks/[id]/route.ts`
- `src/app/api/hermes/kanban/bulk/route.ts`
- `src/lib/hermes/kanban-write.ts`
- `src/components/hermes/worker-drawer.tsx`
- `src/components/hermes/all-issues-panel.tsx`
- `src/components/kanban/hermes-kanban.tsx`
- `src/lib/hermes/crew-core.test.ts`

**Approach:**
- Tighten task-action request shapes so status changes and reassignments can require note/handoff payloads before the write bridge is invoked.
- Add a server-side status-to-transition mapping layer so the worker drawer and All issues can use operator-friendly status language without leaking raw Hermes transition verbs into the UI.
- Restrict reassignment choices in the worker drawer to the named worker lanes defined by the Hermes crew configuration.
- Introduce confirmation UX for destructive or disruptive actions that states exact side effects before execution.
- Extend bulk status changes so they accept one shared note/handoff, validate compatibility, and record the resulting action history.
- Preserve the existing Hermes CLI transition bridge as the final state-machine authority; the dashboard should prevent bad submissions early, not replace CLI validation.
- Return a shared mutation result envelope with success/failure, plain-English summary, raw detail, audit id, and refresh hints so retries and reranking behave consistently.

**Patterns to follow:**
- `src/app/api/hermes/kanban/tasks/[id]/route.ts` and `src/app/api/hermes/kanban/bulk/route.ts` for current mutation route style
- `src/lib/hermes/kanban-write.ts` for allowlisted CLI-backed writes
- `src/components/kanban/hermes-kanban.tsx` for status-action affordances and bulk bars

**Test scenarios:**
- Covers AE4. Reassigning a blocked task and changing status requires a note/handoff and records the side effects before submission.
- Covers AE7. Bulk status changes reject empty selections, require one shared note, and apply only to compatible items.
- Given an invalid reassignment target outside the known worker lanes, the UI and route both reject it.
- Given a destructive action such as archive, the confirmation copy names the affected object and the disruptive effect.
- Given a CLI-level transition failure, the dashboard surfaces a plain-English failure summary and retains the operator-entered note for retry context.

**Verification:**
- Task and bulk actions match the v1 safety contract without bypassing Hermes CLI invariants.
- Operators cannot make silent state changes without leaving note/handoff context behind.

### U6. Add cron, session, and config-gap remediation affordances to the worker drawer
**Goal:** Finish the v1 remediation loop for non-task issues so operators can act on failed jobs, resumable sessions, and channel/config gaps from the same worker surface.

**Requirements:** R17-R21, R30-R32, F3, AE5, AE8

**Dependencies:** U2, U3

**Files:**
- `src/lib/hermes/cron-actions.ts`
- `src/app/api/hermes/cron/[id]/[action]/route.ts`
- `src/components/hermes/worker-drawer.tsx`
- `src/components/agent/session-workspace.tsx`
- `src/lib/types.ts`
- `src/lib/hermes/crew-core.test.ts`

**Approach:**
- Expose run now, pause, resume, and view logs/errors within cron-backed issue details, with plain-English summaries and raw detail expansion.
- Reuse the existing session-opening hook from `SessionWorkspace` so session-related issues can jump straight into the associated Hermes session with worker/issue/task context preserved.
- Add config-gap detail cards that show expected state, observed state, and remediation guidance with linked context instead of in-dashboard editing.
- Feed every successful or failed non-task action into the mission-control audit trail and worker Activity section.
- Ensure post-action refresh returns the operator to the worker issue list and reranks remaining issues instead of dropping them into a generic success state.

**Patterns to follow:**
- `src/lib/hermes/cron-actions.ts` and `src/app/api/hermes/cron/[id]/[action]/route.ts` for safe cron controls
- `src/components/agent/session-workspace.tsx` for session switching behavior
- `src/components/kanban/hermes-kanban.tsx` for inline action result toasts and detail expansion patterns

**Test scenarios:**
- Covers AE5. Failed cron issues show plain-English summaries first and expose run/pause/resume plus raw detail access.
- Given a session-linked issue, the operator can open the related session without losing worker/task context.
- Given a missing private channel or profile gap, the issue detail shows expected vs observed state and remediation guidance rather than a dead-end warning.
- Given a cron action fails at the CLI layer, the dashboard shows a plain-English failure state and does not falsely rerank the issue as resolved.
- Covers AE8. Successful cron or session-related actions appear in recent activity and action history after refresh.

**Verification:**
- Non-task issues become operable from the worker drawer, completing the v1 operator-console loop.
- Cron, session, and config remediation all share the same refresh and audit semantics as task actions.

---

## Risk Analysis & Mitigation

- **Risk: ranking feels arbitrary or unstable.**
  Mitigation: centralize ranking in the normalization layer, cover mixed-signal ordering in tests, and keep the initial scoring model intentionally small and deterministic.

- **Risk: UI complexity grows faster than the current DTOs can support.**
  Mitigation: add explicit issue and action DTOs first (U1/U2) before UI work so the drawer and All issues view are not forced to infer semantics ad hoc.

- **Risk: required-note enforcement conflicts with current Kanban UX.**
  Mitigation: implement the stricter contract in the Hermes operator surfaces first, then optionally back-port the same shape into the standalone Kanban UI where appropriate.

- **Risk: action history becomes inconsistent with live Hermes state.**
  Mitigation: store audit records only after write-route outcomes are known, record both successful and failed attempts distinctly, and read them back into the dashboard as a separate history channel rather than as the source of truth for current object state.

- **Risk: the page becomes too noisy and loses the compact worker-card value.**
  Mitigation: keep cards compact by pushing most explanatory content into the drawer and All issues panel, exactly as defined in the origin requirements.

---

## Phased Delivery

1. **Foundation:** U1 + U2
   - normalize issues
   - evolve the existing crew API contract
   - add mission-control audit substrate

2. **Primary operator surface:** U3
   - interactive cards
   - worker drawer
   - issue-first detail model

3. **Cross-worker triage:** U4
   - All issues
   - grouping, filtering, search
   - drawer focus routing

4. **Safe actions:** U5 + U6
   - required-note task flows
   - bulk transitions
   - cron/session/config remediation
   - final reranking and audit integration

This sequencing keeps product value visible early without building action UX on top of unstable DTOs, and moves write-contract hardening ahead of richer multi-object remediation flows.

---

## Verification Strategy

- Expand Hermes normalization and route tests so ranking, issue typing, and audit behavior are covered in node:test.
- Use focused component verification for the Hermes page to ensure cards, drawer sections, and All issues behavior render from real normalized DTOs.
- Verify the happy path and failure path of task, bulk, cron, and session actions, with special attention to note requirements and post-action reranking.
- Re-run Hermes-specific regression checks after implementation, especially the current Hermes test suite and any broadened Hermes test entry added in U1.

---

## Scope Boundaries

### Deferred to Follow-Up Work
- Fine-tuning the production-impact scoring model with historical trend data or learned heuristics.
- Rich trend analytics in the worker scorecards.
- RBAC / multi-operator permissions beyond the current trusted-operator assumption.
- Full cron editing (schedule, prompt, skills, delivery target mutation).
- Direct config or channel-map editing in the dashboard.
- Snoozing, saved searches, and advanced query operators.

### Outside This Plan
- Replacing the worker-first home surface with a flat issue queue.
- Bypassing Hermes CLI invariants with direct task or cron database writes.
- Rebuilding the generic Kanban board UX as part of this operator-console effort.

---

## Open Questions

- Should Hermes action history be surfaced only inside worker drawers in v1, or also as a top-level Mission Control activity mode once the substrate exists?
- When a config-gap issue links to multiple files or directories, what is the smallest useful linked-context representation that stays read-only but still actionable?
- If the Hermes team later wants parity between the standalone Kanban board and the worker drawer note-enforcement rules, should that be handled by shared form components or by shared route contract helpers?
