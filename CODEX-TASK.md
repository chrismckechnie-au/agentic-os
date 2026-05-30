# Codex Task: Ship Agentic OS to Ubuntu (Phase A + B)

## Overview

Agentic OS is a Next.js 16.2.6 (App Router) dashboard that reads real local data from Claude Code,
Codex, and Hermes on the host machine. It currently runs on Windows. This task makes it
production-ready for Linux and commits it to a private GitHub repo.

**Do not touch anything not listed below.** The app is working on Windows — surgical changes only.

---

## Status Check Before Starting

Run these to verify current state:

```bash
npx tsc --noEmit   # should be clean
npm run lint       # should be clean
```

If either fails, **stop and report** — do not proceed.

---

## Task 1 — Fix `server.mjs`: ALLOWED_ROOTS + hostname

**File:** `server.mjs` (repo root)

### Change 1: ALLOWED_ROOTS

**Find this line (line ~35):**
```js
const ALLOWED_ROOTS = [process.cwd(), os.homedir(), "F:\\Development", "/home", "/Users"];
```

**Replace with:**
```js
const ALLOWED_ROOTS = [
  process.cwd(),
  os.homedir(),
  ...(isWin ? ["F:\\Development"] : ["/home", "/Users"]),
  ...(process.env.AGENTIC_ALLOWED_ROOTS
    ? process.env.AGENTIC_ALLOWED_ROOTS.split(path.delimiter).filter(Boolean)
    : []),
];
```

The `isWin` constant is already defined above this line as `const isWin = process.platform === "win32";`.

### Change 2: hostname default

**Find this line (line ~20):**
```js
const hostname = process.env.HOSTNAME || undefined; // undefined → listen on all interfaces
```

**Replace with:**
```js
const hostname = process.env.HOSTNAME || "127.0.0.1";
```

Remove the comment — the new default IS the behaviour we want.

---

## Task 2 — Create `src/lib/obsidian/reader.ts`

**File:** `src/lib/obsidian/reader.ts` (NEW — server-only)

This mirrors the shape of `src/lib/claude-code/reader.ts`. Read that file first for style reference.

The `Note` type is defined in `src/lib/types.ts`:
```typescript
export interface Note {
  id: string;
  title: string;
  updatedAt: string;
  group?: string;
  body: string;
}
```

**Create the file with this exact content:**

```typescript
// Server-only. Reads Obsidian vault markdown files from VAULT_PATH env var.
import fs from "node:fs";
import path from "node:path";
import type { Note } from "@/lib/types";

function getVaultPath(): string | null {
  const p = process.env.VAULT_PATH;
  if (!p) return null;
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  } catch {
    /* ignore */
  }
  return null;
}

// Tiny YAML frontmatter parser — no new deps.
// Returns { title?, tags?, updated? } from the --- block if present.
function parseFrontmatter(content: string): { title?: string; tags?: string[]; updated?: string } {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end === -1) return {};
  const block = content.slice(4, end);
  const result: { title?: string; tags?: string[]; updated?: string } = {};
  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "title" && val) result.title = val;
    if (key === "updated" || key === "date") result.updated = val;
    if (key === "tags") {
      // Support: tags: [a, b] or tags: a, b
      result.tags = val
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return result;
}

function firstHeading(content: string): string | null {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function collectMarkdownFiles(dir: string, results: string[] = []): string[] {
  const SKIP = new Set([".obsidian", ".trash", ".git", "node_modules"]);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(full, results);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

export function readNotes(limit = 200): Note[] {
  const vault = getVaultPath();
  if (!vault) return [];

  const files = collectMarkdownFiles(vault);
  const notes: Note[] = [];

  for (const file of files) {
    if (notes.length >= limit) break;
    try {
      const stat = fs.statSync(file);
      const content = fs.readFileSync(file, "utf-8");
      const fm = parseFrontmatter(content);
      const title =
        fm.title ??
        firstHeading(content) ??
        path.basename(file, ".md");
      const updatedAt = fm.updated ?? stat.mtime.toISOString();
      // id = relative path from vault root, slashes normalized
      const id = path.relative(vault, file).replace(/\\/g, "/");
      // group = top-level folder name, or "Root"
      const parts = id.split("/");
      const group = parts.length > 1 ? parts[0] : "Root";

      notes.push({
        id,
        title,
        updatedAt,
        group,
        body: content.slice(0, 2000), // cap body for UI perf
      });
    } catch {
      /* skip unreadable files */
    }
  }

  // Sort by mtime descending (most recently modified first)
  notes.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return notes;
}

export function readVaultStats(): { notes: number; links: number } {
  const vault = getVaultPath();
  if (!vault) return { notes: 0, links: 0 };

  const files = collectMarkdownFiles(vault);
  let links = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.match(/\[\[[^\]]+\]\]/g);
      if (matches) links += matches.length;
    } catch {
      /* skip */
    }
  }

  return { notes: files.length, links };
}
```

---

## Task 3 — Wire Obsidian in `src/app/agents/[agent]/page.tsx`

**File:** `src/app/agents/[agent]/page.tsx`

Add these two imports at the top with the other reader imports:

```typescript
import { readNotes, readVaultStats } from "@/lib/obsidian/reader";
```

Then find the `codex` block (ends around line 82) and add an `obsidian` block immediately after it,
before the `const realData` line:

**Find this block:**
```typescript
  const realData = agent === "claude-code" || agent === "codex";
```

**Insert BEFORE that line:**
```typescript
  if (agent === "obsidian") {
    const notes = readNotes(200);
    if (notes.length > 0) {
      data.notes = notes;
    }
    // vault stats available for future Graph tab header use
    // const vaultStats = readVaultStats();
  }
```

No other changes to this file.

---

## Task 4 — Fix Obsidian status detection in `src/lib/agents/detect.ts`

**File:** `src/lib/agents/detect.ts`

### Change 1: Add `fs` import

Add at the top with the other imports:
```typescript
import fs from "node:fs";
import os from "node:os";
```

### Change 2: Replace `processRunning("Obsidian")` detection

**Find:**
```typescript
  // ── Obsidian ─────────────────────────────────────────────────────────────────
  const obsidianRunning = processRunning("Obsidian");
```

**Replace with:**
```typescript
  // ── Obsidian ─────────────────────────────────────────────────────────────────
  // On a headless Ubuntu server, Obsidian GUI never runs — detect vault presence instead.
  const vaultPath = process.env.VAULT_PATH;
  const obsidianRunning = vaultPath
    ? (() => { try { return fs.existsSync(vaultPath) && fs.statSync(vaultPath).isDirectory(); } catch { return false; } })()
    : processRunning("Obsidian");
```

This keeps the `processRunning` fallback for Windows (where `VAULT_PATH` isn't set) and uses
directory existence on Linux (where `VAULT_PATH` will be set via the env file).

---

## Task 5 — Add `engines` field to `package.json`

**File:** `package.json`

Add after the `"private": true` line:

```json
  "engines": {
    "node": ">=20"
  },
```

The full top of the file should look like:
```json
{
  "name": "agentic-os",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=20"
  },
  "scripts": {
```

---

## Task 6 — Create `.env.example`

**File:** `.env.example` (NEW, repo root)

```bash
# Agentic OS — Environment Variables
# Copy to .env.local for local overrides. Never commit .env.local.

# Server bind / port
PORT=3017
HOSTNAME=127.0.0.1

# Data source: "mock" uses fixture data, "live" reads real local files
DATA_SOURCE=live

# Obsidian vault path (absolute). Required for Obsidian agent page + sidebar dot.
# Example (Ubuntu): /home/chris/vaults/Refuelr
# Example (macOS):  /Users/chris/vaults/Refuelr
VAULT_PATH=

# Hermes kanban SQLite database path. Leave blank to use default (~/.hermes/kanban.db).
HERMES_KANBAN_DB=

# Additional allowed cwd roots for PTY sessions (colon-separated on Linux/macOS,
# semicolon-separated on Windows). server.mjs already includes process.cwd() and
# os.homedir() by default.
# Example: /home/chris/Development
AGENTIC_ALLOWED_ROOTS=
```

---

## Task 7 — Create `deploy/agentic-os.service`

**File:** `deploy/agentic-os.service` (NEW — create the `deploy/` directory)

```ini
# Agentic OS — systemd user service
# Install: cp deploy/agentic-os.service ~/.config/systemd/user/
# Enable:  systemctl --user daemon-reload
#          systemctl --user enable --now agentic-os
# Persist: loginctl enable-linger <username>
# Logs:    journalctl --user -u agentic-os -f
# Tunnel:  ssh -L 3017:localhost:3017 user@box  →  http://localhost:3017

[Unit]
Description=Agentic OS Dashboard
After=network.target

[Service]
WorkingDirectory=%h/agentic-os
Environment=NODE_ENV=production
EnvironmentFile=-%h/.agentic-os.env
ExecStart=/usr/bin/node server.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Note: `EnvironmentFile=-%h/.agentic-os.env` — the leading `-` makes it optional (service starts
even if the env file doesn't exist yet, using defaults). Create `~/.agentic-os.env` on the box
with the vars from `.env.example`.

---

## Task 8 — Verify TypeScript + lint still clean

After all changes:

```bash
npx tsc --noEmit
npm run lint
```

Both must pass with zero errors. If either fails, fix before proceeding.

Also do a quick sanity check that no client component imports `fs`:

```bash
grep -r "from \"node:fs\"" src/components/
grep -r "from \"fs\"" src/components/
```

Both should return no results.

---

## Task 9 — Git init + push to private GitHub

```bash
git init
git add .
git commit -m "Initial commit: Agentic OS dashboard"
```

Then create the private repo and push. Requires `gh` CLI authenticated:

```bash
gh repo create agentic-os --private --source . --push
```

If `gh` is not authenticated or not available, **stop and report** — do not try alternate approaches.

---

## What NOT to touch

- `src/lib/claude-code/reader.ts` — already cross-platform, no changes needed
- `src/lib/codex/reader.ts` — already cross-platform, no changes needed
- `src/lib/agents/stats.ts` — no changes needed
- `src/lib/overview/real.ts` — no changes needed
- `src/lib/activity/real.ts` — no changes needed
- `src/lib/providers/live/hermes-kanban.ts` — no changes needed
- `src/lib/config/user-config.ts` — no changes needed
- All component files not listed above
- All API route files

---

## Success Criteria

1. `npx tsc --noEmit` — zero errors
2. `npm run lint` — zero errors
3. No `from "node:fs"` or `from "fs"` in `src/components/` (server-only readers stay server-only)
4. `server.mjs` has no hardcoded `"F:\\Development"` (it now appears only inside the `isWin` conditional)
5. `server.mjs` default hostname is `"127.0.0.1"` not `undefined`
6. `src/lib/obsidian/reader.ts` exists and exports `readNotes` and `readVaultStats`
7. `src/app/agents/[agent]/page.tsx` has an `obsidian` block that calls `readNotes()`
8. `src/lib/agents/detect.ts` uses `VAULT_PATH` dir check, not `processRunning`, when env var is set
9. `.env.example` exists at repo root
10. `deploy/agentic-os.service` exists
11. `package.json` has `"engines": { "node": ">=20" }`
12. `git log --oneline` shows at least one commit
13. `gh repo view agentic-os` succeeds (repo created and pushed)
