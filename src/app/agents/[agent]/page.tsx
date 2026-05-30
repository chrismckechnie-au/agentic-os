import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getProvider } from "@/lib/providers";
import { AGENT_ORDER, AGENTS, isAgentId } from "@/lib/config/agents";
import type { AgentId } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SessionWorkspace } from "@/components/agent/session-workspace";
import {
  readSessions as readClaudeSessions,
  readSessionDetail as readClaudeDetail,
} from "@/lib/claude-code/reader";
import {
  readSessions as readCodexSessions,
  readSessionDetail as readCodexDetail,
} from "@/lib/codex/reader";
import { readNotes, readVaultStats } from "@/lib/obsidian/reader";
import type { Session, SessionDetail } from "@/lib/types";
import { buildClaudeStats, buildCodexStats } from "@/lib/agents/stats";

export function generateStaticParams() {
  return AGENT_ORDER.map((agent) => ({ agent }));
}

function accentStyle(hex: string): CSSProperties {
  return {
    ["--accent" as string]: hex,
    ["--accent-soft" as string]: `color-mix(in srgb, ${hex} 16%, transparent)`,
    ["--accent-line" as string]: `color-mix(in srgb, ${hex} 38%, transparent)`,
  };
}

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ agent: string }>;
  searchParams: Promise<{ session?: string; new?: string }>;
}) {
  const { agent } = await params;
  if (!isAgentId(agent)) notFound();

  const { session: reqSession, new: isNew } = await searchParams;
  const data = await getProvider().getAgentPage(agent);
  const cfg = AGENTS[agent];
  let initialDetail: SessionDetail = data.activeSession;

  if (agent === "claude-code") {
    const real = readClaudeSessions(100);
    if (real.length > 0) {
      data.sessions = real.map((s): Session => ({
        id: s.id,
        agentId: "claude-code",
        title: s.title,
        workspace: s.workspace,
        status: s.status,
        updatedAt: s.updatedAt,
        group: s.group,
      }));
      const detailId = reqSession && real.some((r) => r.id === reqSession) ? reqSession : real[0].id;
      const d = readClaudeDetail(detailId);
      if (d) initialDetail = d;
    }
  }

  if (agent === "codex") {
    const real = readCodexSessions(100);
    if (real.length > 0) {
      data.sessions = real.map((s): Session => ({
        id: s.id,
        agentId: "codex",
        title: s.title,
        workspace: s.workspace ?? undefined,
        status: s.status,
        updatedAt: s.updatedAt,
        group: s.group,
      }));
      const detailId = reqSession && real.some((r) => r.id === reqSession) ? reqSession : real[0].id;
      const d = readCodexDetail(detailId);
      if (d) initialDetail = d;
    }
  }

  if (agent === "obsidian") {
    const notes = readNotes(200);
    if (notes.length > 0) {
      data.notes = notes;
    }
    // vault stats available for future Graph tab header use
    // const vaultStats = readVaultStats();
  }

  const realData = agent === "claude-code" || agent === "codex";
  const liveAgent = Boolean(cfg.liveCli);
  const autoStartLive = isNew === "1" && liveAgent;
  const stats =
    agent === "claude-code" ? buildClaudeStats() :
    agent === "codex"       ? buildCodexStats() :
    data.stats;

  return (
    <div style={accentStyle(cfg.accent)}>
      <PageHeader title={cfg.name} subtitle={cfg.tagline} icon={cfg.icon} accent={cfg.accent} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <SessionWorkspace
          agentId={agent as AgentId}
          cfg={cfg}
          initialSessions={data.sessions}
          initialDetail={initialDetail}
          realData={realData}
          liveAgent={liveAgent}
          autoStartLive={autoStartLive}
          memory={data.memory}
          skills={data.skills}
          jobs={data.jobs}
          notes={data.notes}
        />
      </div>
    </div>
  );
}
