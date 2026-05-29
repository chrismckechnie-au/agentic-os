# Live providers (not yet implemented)

These stubs map each data source to where it really lives on the Ubuntu host.
Implement them, compose them in `../index.ts` under `case "live"`, then run with
`DATA_SOURCE=live`. The UI and API routes do not change.

Everything here runs **server-side only** (filesystem, child processes, network).
Never import these from a Client Component.

| File             | Real source                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `claude-code.ts` | `~/.claude/projects/**` session JSONL transcripts + project metadata   |
| `codex.ts`       | `~/.codex/**` session/rollout files                                    |
| `hermes.ts`      | `~/.hermes/` — skills dir, FTS5 SQLite sessions, cron jobs, memory      |
| `obsidian.ts`    | Obsidian vault folder (markdown files, frontmatter, links)             |
| `github.ts`      | GitHub REST API (`GITHUB_TOKEN`), for the Repos section                |

Each file exports the slice of `DataProvider` it owns; `index.ts` composes them
into one object that satisfies the full interface.
