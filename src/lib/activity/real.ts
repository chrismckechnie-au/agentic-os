// Server-only. Derives a real activity / notification feed from local Claude + Codex + Hermes sessions.
import type { ActivityItem } from "@/lib/types";
import {
  readLiveSessionSnapshot,
  type LiveSessionSnapshot,
} from "@/lib/providers/live/session-snapshot";

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

export function buildActivity(
  limit = 8,
  snapshot: LiveSessionSnapshot = readLiveSessionSnapshot(),
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...snapshot.claude.slice(0, 15).map((s) => ({
      id: `cc-${s.id}`,
      icon: statusIcon(s.status),
      text: `Claude Code — ${s.title}`,
      when: s.updatedAt,
      agentId: "claude-code" as const,
    })),
    ...snapshot.codex.slice(0, 15).map((s) => ({
      id: `cx-${s.id}`,
      icon: statusIcon(s.status),
      text: `Codex — ${s.title}`,
      when: s.updatedAt,
      agentId: "codex" as const,
    })),
    ...snapshot.hermes.slice(0, 15).map((s) => ({
      id: `hm-${s.id}`,
      icon: statusIcon(s.status),
      text: `Hermes — ${s.title}`,
      when: s.updatedAt,
      agentId: "hermes" as const,
    })),
    ...snapshot.obsidian.slice(0, 10).map((s) => ({
      id: `ob-${s.id}`,
      icon: "FileText",
      text: `Obsidian — ${s.title}`,
      when: s.updatedAt,
      agentId: "obsidian" as const,
    })),
  ];

  return items.sort((a, b) => weight(a.when) - weight(b.when)).slice(0, limit);
}
