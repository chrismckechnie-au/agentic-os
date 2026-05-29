import "server-only";

import type { Note } from "@/lib/types";

// Live Obsidian source.
//
// TODO(live): read the vault folder directly from the filesystem.
//   - Recursively read *.md files; parse frontmatter for title/tags/updated.
//   - Build backlink graph from [[wikilinks]] for the Graph tab.
//   - Watch the folder (fs.watch) for live updates.
//   - VAULT_PATH from env, e.g. /home/chris/vaults/Refuelr.

export async function listNotes(): Promise<Note[]> {
  throw new Error("obsidian.listNotes not implemented (see TODO).");
}
