import "server-only";

import type { AgentPageData } from "@/lib/providers/types";

// Live Claude Code source.
//
// TODO(live): read from ~/.claude/projects/**
//   - Each project dir holds session transcripts as JSONL.
//   - Parse messages -> SessionMessage[]; derive title, branch, model, tokens.
//   - `git -C <workspace> log` for recent commits; `git status` for files touched.
//   - createSession(): spawn `claude` headless (child_process) bound to a workspace.

export async function getAgentPage(): Promise<AgentPageData> {
  throw new Error("claude-code.getAgentPage not implemented (see TODO).");
}
