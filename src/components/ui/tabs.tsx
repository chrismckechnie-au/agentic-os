"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
  badge?: number;
}

export function Tabs({
  tabs,
  panels,
  defaultId,
  className,
}: {
  tabs: TabDef[];
  panels: Record<string, React.ReactNode>;
  defaultId?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultId ?? tabs[0]?.id);

  return (
    <div className={className}>
      <div role="tablist" className="flex items-center gap-1 border-b border-line px-1">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
                on ? "text-ink" : "text-faint hover:text-muted",
              )}
            >
              {t.label}
              {typeof t.badge === "number" && (
                <span className="rounded-full bg-surface-3 px-1.5 text-[10px] text-muted">{t.badge}</span>
              )}
              {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" />}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{panels[active]}</div>
    </div>
  );
}
