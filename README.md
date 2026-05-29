# Agentic OS

Unified dashboard for AI agents (**Claude Code**, **Codex**, **Hermes**, **Obsidian**), plus
**Repositories** and an **Overview** health page. Visual prototype on mock data, architected to wire
to real sources later.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Scripts: `npm run dev` · `npm run build` · `npm start` · `npm run lint`.

## Pages

| Route               | What                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `/`                 | Overview — stat cards, agent status, recent sessions, system health  |
| `/agents/claude-code` | Claude Code — sessions, live terminal, session details + commits   |
| `/agents/codex`     | Codex — plan, changed files, tests, task details                     |
| `/agents/hermes`    | Hermes — terminal, memory stores, skills, jobs                       |
| `/agents/obsidian`  | Obsidian — note viewer, graph, vault                                 |
| `/repos`            | Repositories (GitHub-shaped)                                         |
| `/workspaces` `/sessions` `/logs` `/settings` | supporting pages                          |

## Architecture — wiring to real data later

The UI never touches a data source directly. Everything flows through one seam:

```
Server Components / API routes ──▶ getProvider() ──▶ MockProvider (now)
                                                  └─▶ Live providers (later)
```

- `src/lib/types.ts` — domain types
- `src/lib/providers/types.ts` — the `DataProvider` interface (the contract)
- `src/lib/providers/mock/` — fixtures + `MockProvider` (current `DATA_SOURCE=mock`)
- `src/lib/providers/live/` — stubs mapping each source to where it really lives on the Ubuntu host
  (`~/.claude`, `~/.codex`, `~/.hermes`, the Obsidian vault, the GitHub API)
- `src/lib/providers/index.ts` — factory that picks the provider from `DATA_SOURCE`

**To go live:** implement the providers in `src/lib/providers/live/`, compose them in `index.ts`
under `case "live"`, then run with `DATA_SOURCE=live`. No UI or route changes. All filesystem /
process / network access stays server-side (guarded by `import "server-only"`).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · lucide-react. Custom dark theme
with a per-agent `--accent` CSS variable; sparklines are inline SVG (no chart lib).
