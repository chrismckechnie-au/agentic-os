export const dynamic = "force-dynamic";

import "server-only";

import Link from "next/link";
import { getProvider } from "@/lib/providers";
import { AGENTS, isAgentId } from "@/lib/config/agents";
import type { AgentId } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { SessionsTable } from "@/components/dashboard/sessions-table";
import { Icon } from "@/components/icon";

function weight(u: string): number {
  if (u === "just now") return 0;
  const m = u.match(/^(\d+)m/);
  if (m) return +m[1];
  const h = u.match(/^(\d+)h/);
  if (h) return +h[1] * 60;
  const d = u.match(/^(\d+)d/);
  if (d) return +d[1] * 1440;
  if (u === "Yesterday") return 1440;
  return 99999;
}

function filterHref(agent: AgentId | "all") {
  return agent === "all" ? "/sessions" : `/sessions?agent=${agent}`;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const params = await searchParams;
  const activeAgent = isAgentId(params.agent ?? "") ? (params.agent as AgentId) : undefined;
  const allSessions = await getProvider().listSessions();
  const sessions = activeAgent
    ? allSessions.filter((session) => session.agentId === activeAgent)
    : allSessions;

  sessions.sort((a, b) => weight(a.updatedAt) - weight(b.updatedAt));

  const running = sessions.filter((session) => session.status === "running" || session.status === "active").length;
  const resumeCapable = sessions.filter((session) => AGENTS[session.agentId].liveCli).length;

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Cross-agent history browser with direct view and resume actions."
        icon="MessageSquare"
      />
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile
          label={activeAgent ? `${AGENTS[activeAgent].name} sessions` : "All sessions"}
          value={sessions.length}
          icon={activeAgent ? AGENTS[activeAgent].icon : "MessageSquare"}
        />
        <MetricTile label="Running now" value={running} icon="Activity" />
        <MetricTile label="Resume capable" value={resumeCapable} icon="Play" />
        <MetricTile label="Agents in view" value={new Set(sessions.map((session) => session.agentId)).size} icon="Cpu" />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">History browser</div>
            <div className="mt-1 text-xs text-faint">Filter by agent, open any saved session, or resume directly where live PTY support exists.</div>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
            <FilterChip
              href={filterHref("all")}
              active={!activeAgent}
              icon="LayoutGrid"
              label="All"
              count={allSessions.length}
            />
            {(Object.keys(AGENTS) as AgentId[]).map((agentId) => (
              <FilterChip
                key={agentId}
                href={filterHref(agentId)}
                active={activeAgent === agentId}
                icon={AGENTS[agentId].icon}
                label={AGENTS[agentId].name}
                count={allSessions.filter((session) => session.agentId === agentId).length}
              />
            ))}
          </div>
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

function FilterChip({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-line bg-surface-2 text-muted hover:border-[var(--accent-line)] hover:text-ink",
      ].join(" ")}
      aria-label={`Filter to ${label}`}
      title={label}
    >
      <Icon name={icon} size={13} />
      <span>{count}</span>
    </Link>
  );
}
