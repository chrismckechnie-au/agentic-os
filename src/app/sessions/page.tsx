import "server-only";

import { readSessions as readClaudeSessions } from "@/lib/claude-code/reader";
import { readSessions as readCodexSessions } from "@/lib/codex/reader";
import { readSessions as readHermesSessions, stateDbExists } from "@/lib/hermes/state";
import type { Session } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { SessionsTable } from "@/components/dashboard/sessions-table";

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

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Every agent session across all workspaces."
        icon="MessageSquare"
      />
      <Card>
        <CardBody className="px-0 py-0">
          <SessionsTable sessions={sessions} />
        </CardBody>
      </Card>
    </>
  );
}
