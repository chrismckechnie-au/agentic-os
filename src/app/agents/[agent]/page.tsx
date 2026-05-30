export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getProvider } from "@/lib/providers";
import { AGENT_ORDER, AGENTS, isAgentId } from "@/lib/config/agents";
import type { AgentId, SessionDetail } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SessionWorkspace } from "@/components/agent/session-workspace";
import {
  readSessionDetail as readClaudeDetail,
} from "@/lib/claude-code/reader";
import {
  readSessionDetail as readCodexDetail,
} from "@/lib/codex/reader";
import { readVaultStats } from "@/lib/obsidian/reader";
import {
  readSessionDetail as readHermesDetail,
} from "@/lib/hermes/state";
import { noteToDetail } from "@/lib/providers/live/obsidian";

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

  let vaultStats: { notes: number; links: number; vaultName: string } | undefined;
  if (agent === "obsidian") {
    if (data.notes && data.notes.length > 0) {
      vaultStats = readVaultStats();
      const selectedNote = reqSession
        ? data.notes.find((note) => note.id === reqSession) ?? data.notes[0]
        : data.notes[0];
      initialDetail = noteToDetail(selectedNote);
    }
  }

  if (agent === "claude-code" && reqSession) {
    const detail = readClaudeDetail(reqSession);
    if (detail) initialDetail = detail;
  }

  if (agent === "codex" && reqSession) {
    const detail = readCodexDetail(reqSession);
    if (detail) initialDetail = detail;
  }

  if (agent === "hermes" && reqSession) {
    const detail = readHermesDetail(reqSession);
    if (detail) initialDetail = detail;
  }

  const realData = agent !== "obsidian";
  const liveAgent = data.agent.liveCliAvailable;
  const autoStartLive = isNew === "1" && liveAgent;

  return (
    <div style={accentStyle(cfg.accent)}>
      <PageHeader title={cfg.name} subtitle={cfg.tagline} icon={cfg.icon} accent={cfg.accent} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.stats.map((stat) => (
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
          vaultStats={vaultStats}
        />
      </div>
    </div>
  );
}
