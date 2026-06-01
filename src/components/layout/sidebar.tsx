"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { AGENT_ORDER, AGENTS } from "@/lib/config/agents";

type AgentStatus = "online" | "offline" | "running" | "degraded";
type Item = { href: string; label: string; icon: string; accent?: string; dot?: boolean };

const MAIN: Item[] = [
  { href: "/", label: "Overview", icon: "LayoutGrid" },
  { href: "/kanban", label: "Kanban", icon: "SquareKanban" },
];

const WORKSPACE: Item[] = [
  { href: "/repos", label: "Repositories", icon: "FolderGit2" },
  { href: "/workspaces", label: "Workspaces", icon: "Boxes" },
];

const ACTIVITY: Item[] = [
  { href: "/sessions", label: "Sessions", icon: "MessageSquare" },
  { href: "/logs", label: "Logs", icon: "ScrollText" },
];

const SYSTEM: Item[] = [{ href: "/settings", label: "Settings", icon: "Settings" }];

const AGENT_ITEMS: Item[] = AGENT_ORDER.map((id) => ({
  href: `/agents/${id}`,
  label: AGENTS[id].name,
  icon: AGENTS[id].icon,
  accent: AGENTS[id].accent,
  dot: true,
}));

function dotColor(status: AgentStatus | undefined): string {
  if (status === "running" || status === "online") return "bg-ok";
  if (status === "degraded") return "bg-danger";
  return "bg-faint";
}

function NavLink({ item, collapsed, active, agentStatus }: { item: Item; collapsed: boolean; active: boolean; agentStatus?: AgentStatus }) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink",
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
          style={{ background: item.accent ?? "var(--accent)" }}
        />
      )}
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <Icon
          name={item.icon}
          size={18}
          className={cn(active && !item.accent && "text-[var(--accent)]")}
          color={item.accent && active ? item.accent : undefined}
        />
        {item.dot && (
          <span className={`absolute -right-1 -top-0.5 size-1.5 rounded-full ring-2 ring-surface ${dotColor(agentStatus)}`} />
        )}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function Section({
  title,
  items,
  collapsed,
  isActive,
  agentStatuses,
}: {
  title?: string;
  items: Item[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
  agentStatuses?: Record<string, AgentStatus>;
}) {
  return (
    <div className="space-y-0.5">
      {title && !collapsed && (
        <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-faint">{title}</p>
      )}
      {title && collapsed && <div className="mt-3 mb-1 border-t border-line" />}
      {items.map((it) => {
        const agentId = it.href.startsWith("/agents/") ? it.href.replace("/agents/", "") : undefined;
        return (
          <NavLink
            key={it.href}
            item={it}
            collapsed={collapsed}
            active={isActive(it.href)}
            agentStatus={agentId ? agentStatuses?.[agentId] : undefined}
          />
        );
      })}
    </div>
  );
}

interface UsageData {
  pct: number;
  resetsAt: string | null;
}

interface ClaudeUsageData {
  fiveHour: UsageData | null;
  sevenDay: UsageData | null;
  sevenDayOpus: UsageData | null;
  sevenDaySonnet: UsageData | null;
  fetchedAt: string;
}

interface CodexUsageData {
  fiveHour: UsageData | null;
  sevenDay: UsageData | null;
  fetchedAt: string;
  updatedAt: string | null;
  source: "session";
  planType: string | null;
  rateLimitReachedType: string | null;
}

const CLAUDE_USAGE_REFRESH_MS = 180_000;

function formatPlanType(planType: string | null | undefined): string | null {
  if (!planType) return null;
  return planType
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function countdownLabel(resetsAt: string | null, now: number): string {
  if (!resetsAt) return "Reset unavailable";
  const diff = new Date(resetsAt).getTime() - now;
  if (!Number.isFinite(diff)) return "Reset unavailable";
  if (diff <= 0) return "Resetting soon";

  const totalMinutes = Math.floor(diff / 60_000);
  if (totalMinutes < 60) return `Resets in ${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) return `Resets in ${hours}h ${minutes}m`;

  const days = Math.floor(hours / 24);
  return `Resets in ${days}d ${hours % 24}h`;
}

function fetchedLabel(fetchedAt: string, now: number): string {
  const diff = now - new Date(fetchedAt).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "Updated just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `Updated ${hours}h ago`;
}

function UsageMeter({
  label,
  usage,
  now,
  accent,
}: {
  label: string;
  usage: UsageData;
  now: number;
  accent: string;
}) {
  const toneClass = usage.pct >= 90 ? "bg-danger" : usage.pct >= 75 ? "bg-warn" : "";
  const clamped = Math.max(0, Math.min(100, usage.pct));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-ink">{usage.pct.toFixed(1)}%</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${toneClass}`}
          style={{
            width: `${clamped}%`,
            ...(toneClass ? {} : { backgroundColor: accent }),
          }}
        />
      </div>
      <p className="text-[10.5px] text-faint">{countdownLabel(usage.resetsAt, now)}</p>
    </div>
  );
}

function UsageCard({
  title,
  icon,
  accent,
  usage,
  error,
  now,
  extraRows,
  note,
}: {
  title: string;
  icon: string;
  accent: string;
  usage: {
    fiveHour: UsageData | null;
    sevenDay: UsageData | null;
    fetchedAt: string;
  } | null;
  error: string | null;
  now: number;
  extraRows?: Array<{ label: string; usage: UsageData | null }>;
  note?: string | null;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line p-3" style={{ background: "rgba(20,22,28,0.66)" }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold">
          <Icon name={icon} size={14} color={accent} />
          {title}
        </span>
        <span className="text-[11px] text-faint">Usage</span>
      </div>
      {usage ? (
        <div className="mt-3 space-y-3">
          {usage.fiveHour && <UsageMeter label="5h Window" usage={usage.fiveHour} now={now} accent={accent} />}
          {usage.sevenDay && <UsageMeter label="7d Window" usage={usage.sevenDay} now={now} accent={accent} />}
          {extraRows?.map((row) => (
            row.usage ? <UsageMeter key={row.label} label={row.label} usage={row.usage} now={now} accent={accent} /> : null
          ))}
          <p className="text-[10.5px] text-faint">{fetchedLabel(usage.fetchedAt, now)}</p>
          {note && <p className="text-[10.5px] text-faint">{note}</p>}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-3 text-[11px] text-faint">
          <div className="font-medium text-muted">Unavailable</div>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-faint">Loading usage…</p>
      )}
    </div>
  );
}

export function Sidebar({ agentStatuses }: { agentStatuses?: Record<string, AgentStatus> }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [claudeUsage, setClaudeUsage] = useState<ClaudeUsageData | null>(null);
  const [claudeUsageError, setClaudeUsageError] = useState<string | null>(null);
  const [codexUsage, setCodexUsage] = useState<CodexUsageData | null>(null);
  const [codexUsageError, setCodexUsageError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const readJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Usage unavailable");
      }
      return data as T;
    };

    const loadUsage = async () => {
      try {
        const [claudeResult, codexResult] = await Promise.allSettled([
          readJson<ClaudeUsageData>("/api/claude-usage"),
          readJson<CodexUsageData>("/api/codex/rate-limits"),
        ]);
        if (!active) return;

        if (claudeResult.status === "fulfilled") {
          setClaudeUsage(claudeResult.value);
          setClaudeUsageError(null);
        } else {
          setClaudeUsage(null);
          setClaudeUsageError(
            claudeResult.reason instanceof Error ? claudeResult.reason.message : "Claude usage unavailable",
          );
        }

        if (codexResult.status === "fulfilled") {
          setCodexUsage(codexResult.value);
          setCodexUsageError(null);
        } else {
          setCodexUsage(null);
          setCodexUsageError(
            codexResult.reason instanceof Error ? codexResult.reason.message : "Codex usage unavailable",
          );
        }
      } catch (error: unknown) {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Usage unavailable";
        setClaudeUsage(null);
        setCodexUsage(null);
        setClaudeUsageError(message);
        setCodexUsageError(message);
      }
    };

    void loadUsage();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadUsage();
      }
    }, CLAUDE_USAGE_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadUsage();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface/60 backdrop-blur transition-all min-[960px]:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-4">
        <span
          className="grid size-8 place-items-center rounded-lg text-white"
          style={{ background: "linear-gradient(135deg,#7c6cff,#9d7cff)" }}
        >
          <Icon name="Hexagon" size={18} />
        </span>
        {!collapsed && (
          <span className="text-[15px] font-bold tracking-tight">
            AGENTIC <span className="text-[var(--accent)]">OS</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <Section items={MAIN} collapsed={collapsed} isActive={isActive} />
        <Section title="AI Agents" items={AGENT_ITEMS} collapsed={collapsed} isActive={isActive} agentStatuses={agentStatuses} />
        <Section title="Workspace" items={WORKSPACE} collapsed={collapsed} isActive={isActive} />
        <Section title="Activity" items={ACTIVITY} collapsed={collapsed} isActive={isActive} />
        <Section title="System" items={SYSTEM} collapsed={collapsed} isActive={isActive} />
      </nav>

      {/* Footer: plan + collapse */}
      <div className="border-t border-line p-3">
        {!collapsed && (
          <div className="mb-3 space-y-3">
            <UsageCard
              title="Claude Code"
              icon="ClaudeLogo"
              accent="#e8682c"
              usage={claudeUsage}
              error={claudeUsageError}
              now={now}
              extraRows={[
                { label: "7d Sonnet", usage: claudeUsage?.sevenDaySonnet ?? null },
                { label: "7d Opus", usage: claudeUsage?.sevenDayOpus ?? null },
              ]}
            />
            <UsageCard
              title="Codex"
              icon="OpenAILogo"
              accent="#10b981"
              usage={codexUsage}
              error={codexUsageError}
              now={now}
              note={[
                codexUsage?.updatedAt ? `Snapshot ${fetchedLabel(codexUsage.updatedAt, now).replace("Updated ", "")}` : null,
                formatPlanType(codexUsage?.planType),
                codexUsage?.rateLimitReachedType ? "Rate limit reached" : null,
              ].filter(Boolean).join(" · ") || null}
            />
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="ChevronsLeft" size={18} className={cn("transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
