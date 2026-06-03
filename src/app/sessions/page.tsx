export const dynamic = "force-dynamic";

import "server-only";

import { readSessions as readClaudeSessions } from "@/lib/claude-code/reader";
import { readSessions as readCodexSessions } from "@/lib/codex/reader";
import { readSessions as readHermesSessions, stateDbExists } from "@/lib/hermes/state";
import type { Session } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { SessionsTable } from "@/components/dashboard/sessions-table";
import { Icon } from "@/components/icon";

function weight(u: string): number {
  if (u === "just now") return 0;
  const m = u.match(/^(\d+)m/); if (m) return +m[1];
  const h = u.match(/^(\d+)h/); if (h) return +h[1] * 60;
  const d = u.match(/^(\d+)d/); if (d) return +d[1] * 1440;
  if (u === "Yesterday") return 1440;
  return 99999;
}

export default function SessionsPage() {
  const claude = (() => { try { return readClaudeSessions(100); } catch { return []; } })();
  const codex  = (() => { try { return readCodexSessions(100); } catch { return []; } })();
  const hermes = stateDbExists() ? (() => { try { return readHermesSessions(100); } catch { return []; } })() : [];

  const sessions: Session[] = [
    ...claude.map((s) => ({
      id: s.id,
      agentId: "claude-code" as const,
      title: s.title,
      workspace: s.workspace,
      status: s.status,
      updatedAt: s.updatedAt,
      group: s.group,
    })),
    ...codex.map((s) => ({
      id: s.id,
      agentId: "codex" as const,
      title: s.title,
      workspace: s.workspace ?? undefined,
      status: s.status,
      updatedAt: s.updatedAt,
      group: s.group,
    })),
    ...hermes,
  ];

  sessions.sort((a, b) => weight(a.updatedAt) - weight(b.updatedAt));
  const running = sessions.filter((session) => session.status === "running" || session.status === "active").length;
  const hermesCount = sessions.filter((session) => session.agentId === "hermes").length;
  const codexCount = sessions.filter((session) => session.agentId === "codex").length;

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Every agent session across all workspaces."
        icon="MessageSquare"
      />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Total sessions" value={sessions.length} icon="MessageSquare" />
        <MetricTile label="Running now" value={running} icon="Activity" />
        <MetricTile label="Hermes" value={hermesCount} icon="HermesLogo" />
        <MetricTile label="Codex" value={codexCount} icon="OpenAILogo" />
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <div className="text-sm font-semibold text-ink">Cross-agent timeline</div>
            <div className="mt-1 text-xs text-faint">Newest sessions first, with direct links back into each workspace.</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-[11px] font-semibold text-ok">
            <span className="size-1.5 rounded-full bg-ok" />
            Live index
          </span>
        </div>
        <CardBody className="px-0 py-0">
          <SessionsTable sessions={sessions} />
        </CardBody>
      </Card>
    </>
  );
}

function MetricTile({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="tile px-4 py-3">
      <div className="flex items-center gap-2 text-[var(--color-faint)]">
        <Icon name={icon} size={14} className="text-[var(--accent)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 text-[26px] font-[660] leading-none tabular-nums text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
