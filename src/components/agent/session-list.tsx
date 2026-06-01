"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/ui/badge";
import type { Note, Session } from "@/lib/types";

const GROUP_ORDER = ["Today", "Yesterday", "Previous 7 days"];

export function SessionList({
  sessions,
  activeId,
  onSelect,
  onNew,
  title = "Previous Sessions",
  searchPlaceholder = "Search sessions...",
}: {
  sessions: Session[];
  activeId: string;
  onSelect?: (id: string) => void;
  onNew?: () => void;
  title?: string;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(activeId);

  const groups = useMemo(() => {
    const filtered = sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const g = s.group ?? "Earlier";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    const rank = (g: string) => {
      const i = GROUP_ORDER.indexOf(g);
      return i === -1 ? 999 : i;
    };
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [sessions, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {onNew && (
          <button
            onClick={onNew}
            className="grid size-7 place-items-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:text-ink"
          >
            <Icon name="Plus" size={15} />
          </button>
        )}
      </div>

      <label className="mb-3 flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm">
        <Icon name="Search" size={15} className="text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none"
        />
      </label>

      <div className="-mr-1 flex-1 space-y-4 overflow-y-auto pr-1">
        {groups.map(([group, items]) => (
          <div key={group}>
            <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">{group}</p>
            <div className="space-y-1">
              {items.map((s) => {
                const on = s.id === selected;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s.id); onSelect?.(s.id); }}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                      on
                        ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                        : "border-transparent hover:bg-surface-2/70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-medium text-ink">{s.title}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-faint">{s.workspace}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-faint">{s.updatedAt}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-faint">No sessions match “{query}”.</p>
        )}
      </div>
    </div>
  );
}

function displayTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  return `${days}d ago`;
}

function noteMatches(note: Note, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    note.title,
    note.path,
    note.folder,
    note.group,
    note.excerpt,
    ...(note.tags ?? []),
    note.body,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ObsidianNoteList({
  notes,
  activeId,
  onSelect,
}: {
  notes: Note[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("all");
  const [tag, setTag] = useState("all");

  const folders = useMemo(
    () => ["all", ...[...new Set(notes.map((note) => note.folder ?? note.group ?? "Root"))].sort()],
    [notes],
  );
  const tags = useMemo(
    () => ["all", ...[...new Set(notes.flatMap((note) => note.tags ?? []))].sort()],
    [notes],
  );

  const filtered = useMemo(
    () =>
      notes.filter((note) => {
        const folderMatch = folder === "all" || (note.folder ?? note.group ?? "Root") === folder;
        const tagMatch = tag === "all" || (note.tags ?? []).includes(tag);
        return folderMatch && tagMatch && noteMatches(note, query);
      }),
    [folder, notes, query, tag],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <h2 className="text-sm font-semibold">Recent Notes</h2>
        <span className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-faint">
          {filtered.length}/{notes.length}
        </span>
      </div>

      <label className="mb-2 flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm">
        <Icon name="Search" size={15} className="text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes, paths, tags..."
          className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none"
        />
      </label>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="min-w-0 rounded-lg border border-line bg-surface-2 px-2 py-2 text-xs text-muted focus:outline-none"
          aria-label="Filter by folder"
        >
          {folders.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All folders" : value}
            </option>
          ))}
        </select>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="min-w-0 rounded-lg border border-line bg-surface-2 px-2 py-2 text-xs text-muted focus:outline-none"
          aria-label="Filter by tag"
        >
          {tags.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All tags" : `#${value}`}
            </option>
          ))}
        </select>
      </div>

      <div className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
        {filtered.map((note) => {
          const active = note.id === activeId;
          const tagsToShow = (note.tags ?? []).slice(0, 2);
          return (
            <button
              key={note.id}
              onClick={() => onSelect(note.id)}
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                  : "border-transparent hover:bg-surface-2/70",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-sm font-medium text-ink">{note.title}</span>
                <span className="shrink-0 text-[11px] text-faint">{displayTime(note.updatedAt)}</span>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-faint">{note.path ?? note.id}</p>
              {note.excerpt && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{note.excerpt}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {tagsToShow.map((item) => (
                  <span key={item} className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-muted">
                    #{item}
                  </span>
                ))}
                {(note.backlinks?.length ?? 0) > 0 && (
                  <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-muted">
                    {note.backlinks?.length} backlinks
                  </span>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-faint">No notes match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
