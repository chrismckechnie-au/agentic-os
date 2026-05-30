"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { AGENTS } from "@/lib/config/agents";
import type { AgentSummary } from "@/lib/types";

export function OverviewActions({ agents }: { agents: AgentSummary[] }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const liveAgents = agents.filter((agent) => agent.liveCliAvailable);

  const refresh = () => {
    setRefreshing(true);
    router.refresh();
    // router.refresh resolves on the server round-trip; clear the spinner shortly after.
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={refresh}
        className="flex h-[34px] items-center gap-2 rounded-[10px] border px-3 text-sm font-medium transition-colors"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "var(--color-ink)" }}
      >
        <Icon name="RefreshCw" size={14} className={refreshing ? "animate-spin" : undefined} /> Refresh
      </button>

      <div className="relative">
        <button
          onClick={() => liveAgents.length > 0 && setMenuOpen((v) => !v)}
          disabled={liveAgents.length === 0}
          className="flex h-[34px] items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-white transition-colors"
          style={{ background: "var(--accent)", boxShadow: "0 6px 20px -8px color-mix(in srgb, var(--accent) 70%, transparent)" }}
        >
          <Icon name="Plus" size={14} /> New Session
          <Icon name="ChevronDown" size={13} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-10 z-20 min-w-48 rounded-lg border border-line bg-surface-2 py-1 shadow-lg">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                Start live session
              </p>
              {liveAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(`/agents/${agent.id}?new=1`);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-3"
                >
                  <Icon name={AGENTS[agent.id].icon} size={14} className="text-muted" />
                  {agent.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
