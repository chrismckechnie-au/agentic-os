import { Icon } from "@/components/icon";
import { AGENTS } from "@/lib/config/agents";
import type { AgentId } from "@/lib/types";

/** Compact agent identity: accent icon + name. */
export function AgentTag({ id, className }: { id: AgentId; className?: string }) {
  const cfg = AGENTS[id];
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <span style={{ color: cfg.accent }}>
        <Icon name={cfg.icon} size={15} />
      </span>
      <span className="text-ink">{cfg.name}</span>
    </span>
  );
}
