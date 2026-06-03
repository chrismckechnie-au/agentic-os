"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { AGENT_ORDER, AGENTS } from "@/lib/config/agents";

type AgentStatus = "online" | "offline" | "running" | "degraded";
type Item = { href: string; label: string; icon: string; accent?: string; dot?: boolean; badge?: string };

const MAIN: Item[] = [
  { href: "/", label: "Command Center", icon: "Orbit" },
  { href: "/kanban", label: "Kanban", icon: "SquareKanban", badge: "Live" },
];

const WORKSPACE: Item[] = [
  { href: "/repos", label: "Repositories", icon: "FolderGit2" },
  { href: "/workspaces", label: "Workspaces", icon: "Boxes" },
];

const ACTIVITY: Item[] = [
  { href: "/sessions", label: "Sessions", icon: "MessageSquare" },
  { href: "/logs", label: "Logs", icon: "ScrollText" },
];

const INTEGRATIONS: Item[] = [
  { href: "/discord", label: "Discord", icon: "DiscordLogo", badge: "Bridge" },
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

function NavLink({
  item,
  active,
  agentStatus,
  onNavigate,
}: {
  item: Item;
  active: boolean;
  agentStatus?: AgentStatus;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-[11px] rounded-[8px] px-[11px] py-2 text-[13.5px] font-medium transition-colors",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] "
          : "text-[var(--color-ink-2)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]",
      )}
    >
      {active && (
        <span
          className="absolute -left-3 top-1/2 h-[18px] w-[3px] rounded-r-[3px] -translate-y-1/2"
          style={{ background: item.accent ?? "var(--accent)" }}
        />
      )}
      <span className={cn("relative flex size-[17px] shrink-0 items-center justify-center",
        active && !item.accent ? "text-[var(--accent-2)]" : active && item.accent ? "text-[var(--accent-2)]" : "text-[var(--color-muted)]")}>
        <Icon
          name={item.icon}
          size={17}
          color={item.accent && active ? item.accent : undefined}
        />
        {item.dot && (
          <span className={`absolute -right-1 -top-0.5 size-2 rounded-full ring-2 ring-[var(--color-canvas-2)] ${dotColor(agentStatus)}`} />
        )}
      </span>
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span className={cn("ml-auto text-[10.5px] font-semibold rounded-full px-[7px] py-0.5 text-center",
          active ? "text-[var(--accent-ink)] bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]" : "text-[var(--color-muted)] bg-[var(--color-surface-3)]"
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function Section({
  title,
  items,
  isActive,
  agentStatuses,
  onNavigate,
}: {
  title?: string;
  items: Item[];
  isActive: (href: string) => boolean;
  agentStatuses?: Record<string, AgentStatus>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-[2px]">
      {title && (
        <p className="px-[12px] py-[6px] pt-[14px] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">{title}</p>
      )}
      {items.map((it) => {
        const agentId = it.href.startsWith("/agents/") ? it.href.replace("/agents/", "") : undefined;
        return (
          <NavLink
            key={it.href}
            item={it}
            active={isActive(it.href)}
            agentStatus={agentId ? agentStatuses?.[agentId] : undefined}
            onNavigate={onNavigate}
          />
        );
      })}
    </div>
  );
}

export function Sidebar({
  agentStatuses,
  mobile = false,
  onNavigate,
}: {
  agentStatuses?: Record<string, AgentStatus>;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex-col gap-[4px] overflow-y-auto border-r border-[var(--color-line)] px-3 py-4",
        mobile
          ? "flex h-full bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_220px),var(--color-canvas-2)]"
          : "sticky top-0 hidden h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent),var(--color-canvas-2)] lg:flex",
      )}
      style={{ width: "240px", padding: "16px 12px" }}
    >
      {/* Brand */}
      <div className="rounded-[16px] border border-[var(--color-line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0)_120px),rgba(255,255,255,0.02)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-[10px]">
          <span
            className="grid size-9 place-items-center rounded-[11px] flex-none text-white"
            style={{ background: "linear-gradient(150deg, var(--accent), var(--accent-2))", boxShadow: "0 10px 22px -12px var(--accent), inset 0 1px 0 rgba(255,255,255,0.35)" }}
          >
            <Icon name="Boxes" size={18} />
          </span>
          <div className="flex flex-col">
            <span className="text-[14.5px] font-semibold tracking-tight text-[var(--color-ink)]">Agentic OS</span>
            <span className="text-[10.5px] text-[var(--color-faint)]">Unified control plane</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2 py-1 text-[10.5px] font-semibold text-ok">
            <span className="size-1.5 rounded-full bg-ok" />
            Live surfaces
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-1 text-[10.5px] font-semibold text-faint">
            Desktop + mobile
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto space-y-1 pt-4">
        <Section items={MAIN} isActive={isActive} onNavigate={onNavigate} />
        <Section title="Agents" items={AGENT_ITEMS} isActive={isActive} agentStatuses={agentStatuses} onNavigate={onNavigate} />
        <Section title="Workspace" items={WORKSPACE} isActive={isActive} onNavigate={onNavigate} />
        <Section title="Activity" items={ACTIVITY} isActive={isActive} onNavigate={onNavigate} />
        <Section title="Integrations" items={INTEGRATIONS} isActive={isActive} onNavigate={onNavigate} />
        <Section title="System" items={SYSTEM} isActive={isActive} onNavigate={onNavigate} />
      </nav>

      {/* Footer: User chip */}
      <div className="border-t border-[var(--color-line)] pt-[12px]">
        <div className="flex items-center gap-[10px] px-[10px] py-2 rounded-[11px] border border-[var(--color-line)] bg-[var(--color-surface-2)]">
          <span className="grid size-[30px] place-items-center rounded-[8px] flex-none text-[12px] font-semibold text-[var(--color-ink-2)] bg-gradient-to-br from-[#2a2d39] to-[#1a1c24]">
            CM
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium">Chris M.</div>
            <div className="text-[10.5px] text-[var(--color-faint)]">Admin · self-hosted</div>
          </div>
          <button className="flex-none size-[30px] rounded-[8px] flex items-center justify-center text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-hover)]">
            <Icon name="LogOut" size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
