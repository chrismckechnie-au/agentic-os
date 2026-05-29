"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { AGENT_ORDER, AGENTS } from "@/lib/config/agents";

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

function NavLink({ item, collapsed, active }: { item: Item; collapsed: boolean; active: boolean }) {
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
          <span className="absolute -right-1 -top-0.5 size-1.5 rounded-full bg-ok ring-2 ring-surface" />
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
}: {
  title?: string;
  items: Item[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="space-y-0.5">
      {title && !collapsed && (
        <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-faint">{title}</p>
      )}
      {title && collapsed && <div className="mt-3 mb-1 border-t border-line" />}
      {items.map((it) => (
        <NavLink key={it.href} item={it} collapsed={collapsed} active={isActive(it.href)} />
      ))}
    </div>
  );
}

interface UsageData {
  available: boolean;
  totalTokens: number;
  outputTokens: number;
  sessions: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/claude-code/usage")
      .then((r) => r.json())
      .then((d) => setUsage(d))
      .catch(() => {});
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const outputTokens = usage?.outputTokens ?? 0;
  const totalTokens = usage?.totalTokens ?? 0;
  const pct = totalTokens > 0 ? Math.round((outputTokens / totalTokens) * 100) : 0;

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface/60 backdrop-blur transition-all",
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
        <Section title="AI Agents" items={AGENT_ITEMS} collapsed={collapsed} isActive={isActive} />
        <Section title="Workspace" items={WORKSPACE} collapsed={collapsed} isActive={isActive} />
        <Section title="Activity" items={ACTIVITY} collapsed={collapsed} isActive={isActive} />
        <Section title="System" items={SYSTEM} collapsed={collapsed} isActive={isActive} />
      </nav>

      {/* Footer: plan + collapse */}
      <div className="border-t border-line p-3">
        {!collapsed && (
          <div className="mb-3 rounded-[var(--radius-card)] border border-line p-3" style={{ background: "rgba(20,22,28,0.66)" }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                Claude Code
              </span>
              <span className="font-mono text-[11px] text-faint">{usage?.available ? `${usage.sessions} sessions` : "—"}</span>
            </div>
            <div className="mt-2 h-[5px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-1000"
                style={{ width: `${usage?.available ? pct : 0}%`, boxShadow: "0 0 8px color-mix(in srgb, var(--accent) 55%, transparent)" }}
              />
            </div>
            {usage?.available ? (
              <p className="mt-2 text-[11px] text-faint">{fmt(totalTokens)} tokens · {pct}% output</p>
            ) : (
              <p className="mt-2 text-[11px] text-faint">Loading usage…</p>
            )}
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
