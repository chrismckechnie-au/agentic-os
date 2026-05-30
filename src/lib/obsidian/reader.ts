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
