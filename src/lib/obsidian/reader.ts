// Server-only. Reads Obsidian vault markdown files from VAULT_PATH env var.
import fs from "node:fs";
import path from "node:path";
import type { Note, VaultStats } from "@/lib/types";
import {
  extractTaskCounts,
  firstHeading,
  parseFrontmatter,
  prepareNotes,
  stripFrontmatter,
} from "@/lib/obsidian/parse";

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
        path: id,
        folder: group,
        tags: fm.tags,
        frontmatter: fm.fields,
        body: stripFrontmatter(content).slice(0, 6000), // cap body for UI perf
      });
    } catch {
      /* skip unreadable files */
    }
  }

  // Sort by mtime descending (most recently modified first)
  notes.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return prepareNotes(notes.slice(0, limit), path.basename(vault));
}

export function readVaultStats(): VaultStats {
  const vault = getVaultPath();
  if (!vault) return { notes: 0, links: 0, vaultName: "—", tags: 0, tasks: 0, openTasks: 0, unresolvedLinks: 0 };

  const files = collectMarkdownFiles(vault);
  let links = 0;
  let tasks = 0;
  let openTasks = 0;
  const tags = new Set<string>();
  const allNotes: Note[] = [];

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.match(/\[\[[^\]]+\]\]/g);
      if (matches) links += matches.length;

      const fm = parseFrontmatter(content);
      for (const tag of fm.tags) tags.add(tag);
      const id = path.relative(vault, file).replace(/\\/g, "/");
      const parts = id.split("/");
      const group = parts.length > 1 ? parts[0] : "Root";
      const note: Note = {
        id,
        title: fm.title ?? firstHeading(content) ?? path.basename(file, ".md"),
        updatedAt: fm.updated ?? stat.mtime.toISOString(),
        group,
        path: id,
        folder: group,
        tags: fm.tags,
        frontmatter: fm.fields,
        body: stripFrontmatter(content),
      };
      allNotes.push(note);
      const counts = extractTaskCounts(note.body);
      tasks += counts.total;
      openTasks += counts.open;
    } catch {
      /* skip */
    }
  }

  const prepared = prepareNotes(allNotes, path.basename(vault));
  const unresolvedLinks = prepared.reduce(
    (sum, note) => sum + (note.outlinks ?? []).filter((link) => !link.resolvedId).length,
    0,
  );

  return {
    notes: files.length,
    links,
    vaultName: path.basename(vault),
    tags: tags.size,
    tasks,
    openTasks,
    unresolvedLinks,
  };
}
