# Integrate Hermes Dashboard Surfaces Into Agentic OS

## Summary
- Make `/agents/hermes` the primary Hermes workspace, with tabs ordered as Chat, Kanban, Sessions, Memory, Skills, Jobs, Settings.
- Keep Chat as the real Hermes TUI over PTY, not a React chat rewrite.
- Bring the Hermes Kanban board into Agentic OS with near-full dashboard parity, including writes, board management, task details, comments, links, runs, diagnostics, attachments, and orchestration actions.
- Add a full Hermes Sessions tab with profile-aware history, search, pagination, message drilldown, and “Resume in Chat”.
- Do not require the Hermes dashboard UI or server to be running.

## Public Interfaces
- Add Hermes profile/path resolution around existing env vars: `HERMES_HOME`, `HERMES_STATE_DB`, `HERMES_KANBAN_DB`, `HERMES_KANBAN_BOARD`.
- Add optional env vars `HERMES_AGENT_REPO` and `HERMES_PYTHON` so Agentic OS can call official Hermes Python modules for Kanban mutations.
- Add API route families under `/api/hermes/kanban/*` for board reads, task detail/log/events, task mutations, comments, links, attachments, bulk actions, dispatch, board CRUD, diagnostics, runs, and orchestration.
- Expand `/api/hermes/sessions/*` to support paginated listing, FTS search, message loading, latest-descendant lookup, and resume-oriented detail data.
- Extend Agentic OS types with Hermes-specific board, task detail, run, event, attachment, comment, session, and diagnostic DTOs while preserving the existing generic `KanbanTask` shape for shared views.

## Implementation Changes
- Add a server-only Hermes resolver that defaults to the active profile from `Z:\.hermes\active_profile` when env vars are unset; use the active profile for sessions/state and resolve Kanban from explicit env, profile board, root board, then legacy DB fallback.
- Rework the Hermes agent page in `\\192.168.50.105\shared\agentic-os\src\components\agent\session-workspace.tsx` so Chat is the default Hermes tab and the existing PTY terminal receives resume IDs from selected sessions.
- Replace the current lightweight Hermes Kanban reader with a richer read layer that maps the Hermes board SQLite data into columns, cards, task drawer data, comments, links, runs, diagnostics, stats, assignees, boards, and event cursors.
- Implement Kanban mutations through a server-only Python bridge that imports Hermes’ own `hermes_cli.kanban_db` and related helpers from `HERMES_AGENT_REPO`; do not duplicate Kanban write rules in TypeScript or write SQLite directly from client code.
- Build a reusable Hermes Kanban workspace used by both `/agents/hermes` and the existing `/kanban` route, with board switcher, filters, drag/drop, bulk actions, task drawer, comments, links, attachments, runs/logs, diagnostics, and guarded destructive actions.
- Add a Hermes Sessions workspace with source/model/message/tool counts, active badges, FTS search, pagination, expandable messages, and “Resume in Chat”; keep destructive session deletion out of v1 unless explicitly requested.
- Use polling or SSE over `task_events` for live Kanban refreshes, avoiding a dependency on the Hermes dashboard WebSocket server.

## Verification
- Run TypeScript and lint checks: `npm run lint` and `npx tsc --noEmit`.
- Smoke-test live reads against the current data: active profile should expose the populated Hermes session DB, and the Refuelr board should load from `Z:\.hermes\kanban\boards\refuelr\kanban.db`.
- Smoke-test mutations only against a temporary copied Hermes home/board DB, covering create, update, move, comment, link, bulk action, archive/delete guard, and board switch.
- Browser-test `/agents/hermes` locally: Chat starts Hermes TUI, Sessions search and resume works, Kanban board renders live columns, task drawer loads, and mutations refetch cleanly.
- Before commit, run a focused code review pass on the bridge, API routes, destructive actions, and path resolution.

## Assumptions And Risks
- Agentic OS should not embed or depend on the Hermes dashboard frontend; it may depend on Hermes Python modules as the source of truth for Kanban behavior.
- The current active Hermes profile is `refuelrops`, with sessions in the profile `state.db`; current Kanban data is in the root Hermes board directory.
- Full Kanban write parity is higher risk than read-only integration, so writes must be allowlisted server-side and tested on a copied board before touching live data.
- No repo files have been changed yet; this is a plan only.
- Git status could not be checked because Git rejected the UNC repo path as dubious ownership; that should be resolved before committing.

Commit-style message: Integrate Hermes dashboard tabs into Agentic OS - Codex
