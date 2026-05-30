# Live providers

These providers map each data source to where it really lives on the Ubuntu host.
Run with `DATA_SOURCE=live` to use them. The UI and API routes should continue
to flow through the provider seam rather than reading host state directly.

Everything here runs **server-side only** (filesystem, child processes, network).
Never import these from a Client Component.

| File             | Real source                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `claude-code.ts` | `~/.claude/projects/**` session JSONL transcripts + project metadata   |
| `codex.ts`       | `~/.codex/**` session/rollout files                                    |
| `hermes.ts`      | `~/.hermes/` — skills dir, SQLite sessions, cron jobs, memory           |
| `obsidian.ts`    | Obsidian vault folder (markdown files, frontmatter, links)             |
| `github.ts`      | GitHub REST API (`GITHUB_TOKEN`), for the Repos section                |

`index.ts` composes these readers into one object that satisfies the full
`DataProvider` interface.
