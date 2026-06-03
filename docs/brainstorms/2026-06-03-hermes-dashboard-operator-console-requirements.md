---
date: 2026-06-03
topic: hermes-dashboard-operator-console
---

# Hermes Dashboard Operator Console Requirements

## Summary

Evolve the Hermes dashboard from a mostly read-only monitoring surface into a worker-first operator console. The v1 experience should help an operator identify production-impacting issues quickly, understand why a worker is flagged in plain English, and take guarded actions directly from the dashboard without losing context.

---

## Problem Frame

The current Hermes dashboard shows useful state, but it leaves too much interpretation and follow-up work to the operator. Worker cards expose flags and attention states without clearly prioritizing by production impact, and the page does not consistently explain what each worker owns, what healthy looks like, or what action should be taken next. As a result, operators can see that Refuelr Ops or Incidents has problems but still need to leave the dashboard to understand the exact blocked task, failed automation, missing channel, or resumable session that caused the warning.

This creates two kinds of friction. First, bulk triage is slower than it should be because the page does not surface a clean cross-worker issue queue with clear ranking and filtering. Second, one-at-a-time fixing is slower than it should be because the dashboard does not yet provide direct, guarded controls for the common actions operators actually need: status changes, reassignment, handoff notes, safe cron controls, and session follow-through.

---

## Actors

- A1. Hermes operator: the trusted person using the dashboard to triage and resolve worker issues.
- A2. Worker lane owner: the conceptual owner of a lane such as Refuelr Ops, Incidents, Engineering, Social, or Research.
- A3. Hermes automation system: the jobs, tasks, sessions, and channel mappings that produce worker health signals.

---

## Key Flows

- F1. Worker-first triage
  - **Trigger:** The operator opens the Hermes dashboard and sees one or more flagged workers.
  - **Actors:** A1, A2, A3
  - **Steps:** The operator scans worker cards, sees priority summaries and a top issue title, opens a worker drawer, reads the plain-English cause, inspects affected objects grouped by severity, and selects the recommended or appropriate action.
  - **Outcome:** The operator can understand why the lane is unhealthy and begin resolving the issue without leaving the dashboard.
  - **Covered by:** R1, R2, R3, R4, R5, R6, R8, R9, R10, R11

- F2. Cross-worker bulk triage
  - **Trigger:** The operator wants to review all active issues across workers.
  - **Actors:** A1, A3
  - **Steps:** The operator opens All issues, reviews a severity-grouped list sorted by production impact, filters or searches the list, selects compatible issues, applies a bulk status change with a shared required note, and returns to refreshed ranking.
  - **Outcome:** The operator can reduce queue friction and handle compatible work across lanes efficiently.
  - **Covered by:** R7, R12, R13, R14, R15

- F3. Guided issue resolution
  - **Trigger:** The operator expands an individual issue or invokes a recommended action.
  - **Actors:** A1, A3
  - **Steps:** The operator reads the plain-English issue explanation, reviews linked context, chooses an action, sees explicit side effects for risky changes, submits the action with the required note or handoff, and receives a success or failure result with refreshed dashboard state.
  - **Outcome:** The dashboard acts as a safe operator console rather than a passive status page.
  - **Covered by:** R6, R8, R9, R10, R11, R16, R17, R18

---

## Requirements

**Worker-first information architecture**
- R1. The Hermes dashboard must remain worker-first, using compact worker cards as the primary entry point for operational triage.
- R2. Each worker card must show status, open count, running count, a priority summary, and the top issue title chosen by highest production impact.
- R3. Each worker card must provide a primary CTA labeled `View issues`.
- R4. Clicking a worker card must open a worker drawer even when that worker has no active flags.
- R5. Worker-card priorities must be system-defined and optimized for production or user impact rather than manual severity assignment.

**Worker drawer structure**
- R6. The worker drawer must present information in this order: Overview, Issues, Activity, Actions.
- R7. The worker drawer header must show the worker name together with status, role, private channel, and model.
- R8. The Overview section must show the worker role and a success-criteria scorecard using current-state metrics only.
- R9. The drawer must explain worker health in plain English before showing detailed object-level evidence.
- R10. The drawer must show affected objects grouped by severity, with dense presentation in bulk-triage contexts and richer presentation in single-worker contexts.
- R11. The drawer must include a primary recommended action based on the most fixable critical action.

**Issue detail model**
- R12. Each issue row must show title, severity, status, and issue type in its compact state.
- R13. Expanding an issue must reveal details in this order: plain-English explanation, linked objects and context, available actions, raw logs or system details, recent related activity, and operator notes or handoff history.
- R14. If a worker is flagged by multiple cause types, the drawer must present cause sections by type rather than a single undifferentiated block.
- R15. Failed cron jobs must show a plain-English failure summary before raw logs.

**Action model**
- R16. v1 task actions must support status changes, reassignment between worker lanes only, and required notes or handoff context for every status or reassignment change.
- R17. v1 cron-job actions must support safe operational controls only: run now, pause, resume, and view logs or errors.
- R18. v1 session actions must support opening or resuming a session together with related worker or task context.
- R19. For channel or configuration gaps, v1 must surface linked config or context and remediation steps rather than direct in-dashboard editing.
- R20. Risky or destructive actions must require confirmation that states the exact side effects before execution.
- R21. Destructive actions must be defined as any action that can lose context, hide work, or disrupt active automation.

**Bulk triage**
- R22. The Hermes page must provide a global `All issues` entry point above the worker cards.
- R23. The All issues view must group issues by severity and sort them by production impact by default.
- R24. Each All issues row must show the worker lane and issue type as its secondary label.
- R25. The All issues view must include default filters for severity, worker lane, and issue type.
- R26. The All issues view must support text search across issue titles, summaries, and related object names.
- R27. Selecting an issue from All issues must open the same worker drawer focused on that issue.
- R28. v1 bulk actions must support bulk status changes for compatible issues only.
- R29. Bulk status changes must allow todo, in progress, blocked, and done, and must apply one shared required note or handoff to the selected items.

**Action outcomes and auditability**
- R30. After a successful action, the dashboard must return the operator to the worker-level issue list and re-rank remaining issues.
- R31. If an action fails, the dashboard must show a plain-English failure summary with expandable raw details.
- R32. Every write action must preserve an audit trail that includes operator, timestamp, target object, action taken, and note or handoff content.

---

## Acceptance Examples

- AE1. **Covers R2, R3, R5.** Given a worker with one critical blocked task and two medium-impact cron failures, when the Hermes page loads, the worker card shows status, counts, a priority summary, the highest-production-impact issue title, and a `View issues` CTA.
- AE2. **Covers R4, R6, R8.** Given a worker with no active flags, when the operator clicks its card, the dashboard opens the worker drawer and shows Overview, Issues, Activity, and Actions, including role and the current-state success scorecard.
- AE3. **Covers R10, R13, R14.** Given a worker flagged by a blocked task, a failed cron job, and a missing private channel, when the operator opens the drawer, the dashboard shows a plain-English cause first and then organizes affected objects by severity with cause sections by type.
- AE4. **Covers R16, R20.** Given a blocked task assigned to Incidents, when the operator reassigns it to Engineering and marks it in progress, the dashboard requires a note or handoff and shows the exact side effects before applying the change.
- AE5. **Covers R17, R15.** Given a failed cron job, when the operator opens its details, the dashboard shows a plain-English failure summary first and allows run now, pause, resume, and raw log inspection.
- AE6. **Covers R22, R23, R27.** Given multiple issues across workers, when the operator opens All issues, the dashboard groups by severity, sorts by production impact, and opens the relevant worker drawer focused on the selected issue.
- AE7. **Covers R28, R29.** Given several compatible task issues selected in All issues, when the operator applies a bulk status change, the dashboard allows one shared required note and updates every selected item to the chosen status.
- AE8. **Covers R30, R31, R32.** Given the operator executes a dashboard action, when it succeeds the dashboard returns to the worker issue list and reranks the queue; when it fails the dashboard shows a plain-English summary with expandable raw details; in both cases the action is retained in the audit trail.

---

## Success Criteria

- Operators can understand why a worker is flagged and reach the exact offending task, job, session, or config gap without leaving the Hermes dashboard.
- Operators can complete the common v1 remediation actions directly from the dashboard with clear side-effect confirmation and preserved handoff context.
- The Hermes page supports both worker-first drill-down and cross-worker bulk triage without changing the primary worker-card mental model.
- Severity, ranking, and recommended actions consistently bias attention toward production-impacting problems rather than cosmetic dashboard cleanup.
- A downstream planner or implementer can build the v1 information architecture, action model, and triage behavior without inventing new operator flows or redefining core success criteria.

---

## Scope Boundaries

- v1 does not require direct in-dashboard editing of channel mappings or low-level configuration files.
- v1 does not require arbitrary reassignment outside the named worker lanes.
- v1 does not require full cron editing such as schedule, prompt, skills, or delivery mutation.
- v1 does not require full session lifecycle management beyond open or resume plus linked context.
- v1 does not require broad bulk control for every object type; bulk actions are limited to compatible status changes.
- v1 does not require sophisticated RBAC; it assumes a trusted-operator environment.
- v1 does not require trend-heavy analytics or historical reporting in the worker success scorecard.
- v1 does not require snoozing, saved searches, or advanced query operators unless later demand proves they are necessary.

---

## Key Decisions

- Keep the dashboard worker-first rather than replacing the primary surface with a flat issue queue.
- Optimize priority and ranking for production or user impact rather than generic severity.
- Keep worker cards compact and move explanatory depth into a drawer.
- Use a hybrid operator experience: fast common controls, but explicit confirmation and side-effect visibility for risky actions.
- Treat plain-English explanation as the first-class layer above raw system detail throughout the experience.

---

## Dependencies / Assumptions

- The dashboard can already resolve live worker, task, cron, session, and channel-mapping state from Hermes data sources.
- The underlying write paths for task mutation, cron safe ops, and session resume can be exposed safely to the dashboard without bypassing Hermes invariants.
- System-defined severity and production-impact ranking can be derived consistently enough from the available worker, task, cron, and routing signals to be useful in v1.
- Required notes or handoff content can be stored in a way that remains visible to later operators.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R5, R11, R23][Technical] What exact scoring model should map worker, task, cron, and routing signals into production-impact severity and recommended-action ranking?
- [Affects R8][Technical] What minimal scorecard metrics best reflect each worker’s current-state health without adding noisy or misleading indicators?
- [Affects R19][Needs research] What is the cleanest dashboard entry point into linked channel or config context for remediation without expanding v1 into full config editing?
- [Affects R32][Technical] Where should the operator-action audit trail be persisted so it is easy to inspect and consistent with existing Hermes event history?
