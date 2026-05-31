import type { Note, NoteBacklink, NoteLink, NoteTaskCounts } from "../types";

export type FrontmatterValue = string | string[];
export type Frontmatter = Record<string, FrontmatterValue>;

export interface ParsedFrontmatter {
  fields: Frontmatter;
  title?: string;
  tags: string[];
  updated?: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const TASK_RE = /^\s*[-*]\s+\[([ xX])]\s+/gm;

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function parseInlineList(value: string): string[] {
  const normalized = value.trim().replace(/^\[|\]$/g, "");
  return normalized
    .split(",")
    .map((item) => stripQuotes(item))
    .filter(Boolean);
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeNoteKey(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

export function stripFrontmatter(content: string): string {
  return content.replace(FRONTMATTER_RE, "").trimStart();
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { fields: {}, tags: [] };

  const fields: Frontmatter = {};
  const lines = match[1].split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const colon = raw.indexOf(":");
    if (colon === -1) continue;

    const key = raw.slice(0, colon).trim();
    const val = raw.slice(colon + 1).trim();
    if (!key) continue;

    if (!val) {
      const list: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        list.push(stripQuotes(lines[j].replace(/^\s*-\s+/, "")));
        j += 1;
      }
      if (list.length > 0) {
        fields[key] = list.filter(Boolean);
        i = j - 1;
      }
      continue;
    }

    fields[key] = val.startsWith("[") && val.endsWith("]") ? parseInlineList(val) : stripQuotes(val);
  }

  const title = typeof fields.title === "string" ? fields.title : undefined;
  const updatedValue = fields.updated ?? fields.date;
  const updated = typeof updatedValue === "string" ? updatedValue : undefined;
  const rawTags = fields.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
      ? parseInlineList(rawTags)
      : [];

  return { fields, title, tags: uniq(tags), updated };
}

export function firstHeading(content: string): string | null {
  const match = stripFrontmatter(content).match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export function extractWikiLinks(content: string): NoteLink[] {
  const links: NoteLink[] = [];
  const seen = new Set<string>();
  const source = stripFrontmatter(content);

  for (const match of source.matchAll(WIKI_LINK_RE)) {
    const rawTarget = match[1].trim();
    const target = rawTarget.split("#")[0].trim();
    if (!target) continue;

    const label = stripQuotes(match[2]?.trim() || rawTarget);
    const key = `${normalizeNoteKey(target)}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    links.push({
      raw: match[0],
      target,
      label,
    });
  }

  return links;
}

export function extractTaskCounts(content: string): NoteTaskCounts {
  let total = 0;
  let completed = 0;
  for (const match of stripFrontmatter(content).matchAll(TASK_RE)) {
    total += 1;
    if (match[1].toLowerCase() === "x") completed += 1;
  }
  return { total, completed, open: total - completed };
}

export function excerptMarkdown(content: string, maxLength = 180): string {
  const text = stripFrontmatter(content)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)]]/g, "$2")
    .replace(/\[\[([^\]]+)]]/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function basenameWithoutExt(value: string): string {
  const last = value.replace(/\\/g, "/").split("/").pop() ?? value;
  return last.replace(/\.md$/i, "");
}

function indexKeys(note: Note): string[] {
  const pathValue = note.path ?? note.id;
  return uniq([
    normalizeNoteKey(note.id),
    normalizeNoteKey(pathValue),
    normalizeNoteKey(note.title),
    normalizeNoteKey(basenameWithoutExt(pathValue)),
  ]);
}

function obsidianUri(pathValue: string, vaultName?: string): string {
  const params = new URLSearchParams();
  if (vaultName && vaultName !== "—") params.set("vault", vaultName);
  params.set("file", pathValue.replace(/\.md$/i, ""));
  return `obsidian://open?${params.toString()}`;
}

export function prepareNotes(notes: Note[], vaultName?: string): Note[] {
  const prepared = notes.map((note) => {
    const pathValue = note.path ?? note.id;
    const pathFolder = pathValue.includes("/") ? pathValue.split("/")[0] : undefined;
    const body = stripFrontmatter(note.body);
    const fm = parseFrontmatter(note.body);
    const tags = uniq([...(note.tags ?? []), ...fm.tags]);

    return {
      ...note,
      path: pathValue,
      folder: note.folder ?? pathFolder ?? note.group ?? "Root",
      body,
      tags,
      frontmatter: note.frontmatter ?? fm.fields,
      outlinks: extractWikiLinks(note.body),
      backlinks: [],
      taskCounts: extractTaskCounts(note.body),
      excerpt: note.excerpt ?? excerptMarkdown(note.body),
      obsidianUri: note.obsidianUri ?? obsidianUri(pathValue, vaultName),
    };
  });

  const keyToId = new Map<string, string>();
  for (const note of prepared) {
    for (const key of indexKeys(note)) {
      if (!keyToId.has(key)) keyToId.set(key, note.id);
    }
  }

  const backlinks = new Map<string, NoteBacklink[]>();

  for (const note of prepared) {
    note.outlinks = (note.outlinks ?? []).map((link) => {
      const resolvedId = keyToId.get(normalizeNoteKey(link.target));
      if (!resolvedId || resolvedId === note.id) return { ...link, resolvedId };

      const list = backlinks.get(resolvedId) ?? [];
      list.push({
        id: note.id,
        title: note.title,
        path: note.path ?? note.id,
        excerpt: note.excerpt,
      });
      backlinks.set(resolvedId, list);
      return { ...link, resolvedId };
    });
  }

  return prepared.map((note) => ({
    ...note,
    backlinks: uniqBacklinks(backlinks.get(note.id) ?? []),
  }));
}

function uniqBacklinks(items: NoteBacklink[]): NoteBacklink[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
