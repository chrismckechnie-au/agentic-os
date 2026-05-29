"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/ui/badge";
import type { Session } from "@/lib/types";

const GROUP_ORDER = ["Today", "Yesterday", "Previous 7 days"];

export function SessionList({ sessions, activeId }: { sessions: Session[]; activeId: string }) {
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
        <h2 className="text-sm font-semibold">Previous Sessions</h2>
        <button className="grid size-7 place-items-center rounded-md border border-line bg-surface-2 text-muted transition-colors hover:text-ink">
          <Icon name="Plus" size={15} />
        </button>
      </div>

      <label className="mb-3 flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm">
        <Icon name="Search" size={15} className="text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions..."
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
                    onClick={() => setSelected(s.id)}
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
