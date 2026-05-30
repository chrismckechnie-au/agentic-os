// Server-only. Derives a real activity / notification feed from local Claude + Codex + Hermes sessions.
import type { ActivityItem } from "@/lib/types";
import { readSessions as readClaudeSessions } from "@/lib/claude-code/reader";
import { readSessions as readCodexSessions } from "@/lib/codex/reader";
import { readSessions as readHermesSessions, stateDbExists } from "@/lib/hermes/state";

// Recency weight for the "Xm ago" / "Xh ago" / "just now" labels the readers emit.
function weight(u: string): number {
  if (u === "just now") return 0;
  const m = u.match(/^(\d+)m/); if (m) return +m[1];
  const h = u.match(/^(\d+)h/); if (h) return +h[1] * 60;
  const d = u.match(/^(\d+)d/); if (d) return +d[1] * 1440;
  if (u === "Yesterday") return 1440;
  return 99999;
}

function statusIcon(status: string): string {
  if (status === "active" || status === "in_progress") return "Activity";
  if (status === "completed") return "CircleCheck";
  return "MessageSquare";
}

export function buildActivity(limit = 8): ActivityItem[] {
  const claude  = (() => { try { return readClaudeSessions(15); } catch { return []; } })();
  const codex   = (() => { try { return readCodexSessions(15); } catch { return []; } })();
  const hermes  = stateDbExists() ? (() => { try { return readHermesSessions(15); } catch { return []; } })() : [];

  const items: ActivityItem[] = [
    ...claude.map((s) => ({
      id: `cc-${s.id}`,
      icon: statusIcon(s.status),
      text: `Claude Code — ${s.title}`,
      when: s.updatedAt,
      agentId: "claude-code" as const,
    })),
    ...codex.map((s) => ({
      id: `cx-${s.id}`,
      icon: statusIcon(s.status),
      text: `Codex — ${s.title}`,
      when: s.updatedAt,
      agentId: "codex" as const,
    })),
    ...hermes.map((s) => ({
      id: `hm-${s.id}`,
      icon: statusIcon(s.status),
      text: `Hermes — ${s.title}`,
      when: s.updatedAt,
      agentId: "hermes" as const,
    })),
  ];

  return items.sort((a, b) => weight(a.when) - weight(b.when)).slice(0, limit);
}
