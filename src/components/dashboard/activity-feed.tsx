import { Icon } from "@/components/icon";
import { AGENTS } from "@/lib/config/agents";
import type { ActivityItem } from "@/lib/types";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((it) => {
        const accent = it.agentId ? AGENTS[it.agentId].accent : "var(--accent)";
        return (
          <li key={it.id} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2/60">
            <span
              className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-line"
              style={{ color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
            >
              <Icon name={it.icon} size={14} />
            </span>
            <p className="min-w-0 flex-1 text-sm text-muted">{it.text}</p>
            <span className="shrink-0 text-xs text-faint">{it.when}</span>
          </li>
        );
      })}
    </ul>
  );
}
