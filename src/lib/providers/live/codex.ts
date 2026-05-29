import "server-only";

import type { AgentPageData } from "@/lib/providers/types";

// Live Codex source.
//
// TODO(live): read from ~/.codex/**
//   - Parse session/rollout files for transcripts, plan steps, changed files.
//   - Derive test pass rate and PR links from run metadata.
//   - createSession(): invoke the codex CLI in a sandbox bound to a repo.

export async function getAgentPage(): Promise<AgentPageData> {
  throw new Error("codex.getAgentPage not implemented (see TODO).");
}
