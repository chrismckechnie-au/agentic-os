"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { AGENTS } from "@/lib/config/agents";
import type { AgentSummary } from "@/lib/types";

const STATUS_MAP: Record<string, { label: string; dotColor: string; bg: string; border: string; text: string }> = {
  running:  { label: "Running",  dotColor: "#34d399", bg: "color-mix(in srgb,#34d399 13%,transparent)", border: "color-mix(in srgb,#34d399 26%,transparent)", text: "#34d399" },
  active:   { label: "Active",   dotColor: "#34d399", bg: "color-mix(in srgb,#34d399 13%,transparent)", border: "color-mix(in srgb,#34d399 26%,transparent)", text: "#34d399" },
  online:   { label: "Online",   dotColor: "#34d399", bg: "color-mix(in srgb,#34d399 13%,transparent)", border: "color-mix(in srgb,#34d399 26%,transparent)", text: "#34d399" },
  degraded: { label: "Degraded", dotColor: "#f59e0b", bg: "color-mix(in srgb,#f59e0b 13%,transparent)", border: "color-mix(in srgb,#f59e0b 26%,transparent)", text: "#f59e0b" },
  offline:  { label: "Offline",  dotColor: "#9aa1ad", bg: "rgba(255,255,255,0.04)",                     border: "rgba(255,255,255,0.08)",                     text: "#9aa1ad" },
};

function StatusPill({ status, pulse }: { status: string; pulse?: boolean }) {
  const m = STATUS_MAP[status] ?? STATUS_MAP.online;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color: m.text, background: m.bg, border: `1px solid ${m.border}` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: m.dotColor,
          ...(pulse ? { animation: "ping-dot 1.8s cubic-bezier(0,0,.2,1) infinite" } : {}),
        }}
      />
      {m.label}
    </span>
  );
}

function MeterBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-[5px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div
        className="h-full rounded-full transition-[width] duration-1000"
        style={{
          width: `${pct}%`,
          background: color,
          boxShadow: `0 0 8px color-mix(in srgb, ${color} 55%, transparent)`,
        }}
      />
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentSummary }) {
  const cfg = AGENTS[agent.id];
  const live = agent.status === "running";
  const cpu = agent.cpu;
  const mem = agent.mem;

  return (
    <Link
      href={`/agents/${agent.id}`}
      className="grid items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-white/[0.025]"
      style={{ gridTemplateColumns: "auto minmax(0,1fr) 128px" }}
    >
      {/* Agent glyph */}
      <span
        className="inline-grid shrink-0 place-items-center rounded-xl"
        style={{
          width: 40,
          height: 40,
          color: cfg.accent,
          background: `color-mix(in srgb, ${cfg.accent} 16%, transparent)`,
          border: `1px solid color-mix(in srgb, ${cfg.accent} 32%, transparent)`,
          boxShadow: live ? `0 0 0 4px color-mix(in srgb, ${cfg.accent} 9%, transparent)` : "none",
        }}
      >
        <Icon name={cfg.icon} size={20} />
      </span>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{agent.name}</span>
          <StatusPill status={agent.status} pulse={live} />
        </div>
        <p className="mt-1 truncate text-[12.5px] text-muted">{agent.currentTask}</p>
        <div className="mt-2 flex items-center gap-3.5">
          <span
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10.5px] text-faint"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
          >
            <Icon name="FolderGit2" size={11} />
            {agent.workspace}
          </span>
          {agent.uptime && (
            <span className="flex items-center gap-1 font-mono text-[10.5px] text-faint">
              <Icon name="Clock" size={11} /> up {agent.uptime}
            </span>
          )}
        </div>
      </div>

      {/* CPU / MEM meters */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-6 text-[9px] font-semibold uppercase tracking-wider text-faint">CPU</span>
          <div className="flex-1">
            {typeof cpu === "number" ? (
              <MeterBar pct={cpu} color={cfg.accent} />
            ) : (
              <div className="h-[5px] rounded-full bg-white/[0.07]" />
            )}
          </div>
          <span className="w-8 text-right font-mono text-[10.5px] tabular-nums text-muted">
            {typeof cpu === "number" ? `${Math.round(cpu)}%` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 text-[9px] font-semibold uppercase tracking-wider text-faint">MEM</span>
          <div className="flex-1">
            {typeof mem === "number" ? (
              <MeterBar pct={mem} color="#9aa1ad" />
            ) : (
              <div className="h-[5px] rounded-full bg-white/[0.07]" />
            )}
          </div>
          <span className="w-8 text-right font-mono text-[10.5px] tabular-nums text-muted">
            {typeof mem === "number" ? `${Math.round(mem)}%` : "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function OrchestrationPanel({ agents }: { agents: AgentSummary[] }) {
  const running = agents.filter((a) => a.status === "running").length;

  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-ink">Agent Orchestration</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              color: "#34d399",
              background: "color-mix(in srgb,#34d399 13%,transparent)",
              border: "1px solid color-mix(in srgb,#34d399 26%,transparent)",
            }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
            {running} running
          </span>
        </div>
        <Link
          href="/agents/claude-code"
          className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          Manage <Icon name="ArrowRight" size={12} />
        </Link>
      </div>
      <div className="divide-y divide-line">
        {agents.map((a) => (
          <AgentRow key={a.id} agent={a} />
        ))}
      </div>
    </div>
  );
}
