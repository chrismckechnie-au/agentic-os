"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { AGENTS } from "@/lib/config/agents";
import type { ActivityItem } from "@/lib/types";

const DISMISSED_NOTIFICATIONS_KEY = "agentic-os:dismissed-notifications";

function readDismissedNotifications(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(-200) : [];
  } catch {
    return [];
  }
}

function writeDismissedNotifications(ids: string[]) {
  try {
    window.localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    // Best-effort persistence only.
  }
}

function Dropdown({
  open,
  onClose,
  children,
  width = "w-56",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className={`absolute right-0 top-12 z-30 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] py-1 shadow-lg panel ${width}`}>
        {children}
      </div>
    </>
  );
}

const SYSTEM_STYLES = {
  healthy: {
    className: "border-ok/25 bg-ok/10 text-ok",
    dot: "bg-ok",
  },
  running: {
    className: "border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent)]",
    dot: "bg-[var(--accent)]",
  },
  degraded: {
    className: "border-warn/25 bg-warn/10 text-warn",
    dot: "bg-warn",
  },
  down: {
    className: "border-danger/25 bg-danger/10 text-danger",
    dot: "bg-danger",
  },
} as const;

export function TopBar({
  notifications = [],
  systemState = "healthy",
  systemLabel = "System ready",
  onToggleSidebar,
}: {
  notifications?: ActivityItem[];
  systemState?: keyof typeof SYSTEM_STYLES;
  systemLabel?: string;
  onToggleSidebar?: () => void;
}) {
  const [open, setOpen] = useState<"org" | "bell" | "avatar" | null>(null);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => readDismissedNotifications());
  const toggle = (m: "org" | "bell" | "avatar") => setOpen((v) => (v === m ? null : m));
  const close = () => setOpen(null);
  const visibleNotifications = notifications.filter((item) => !dismissedNotifications.includes(item.id));
  const count = visibleNotifications.length;
  const systemStyle = SYSTEM_STYLES[systemState] ?? SYSTEM_STYLES.healthy;

  const clearNotifications = () => {
    const next = [...new Set([...dismissedNotifications, ...notifications.map((item) => item.id)])];
    setDismissedNotifications(next);
    writeDismissedNotifications(next);
  };

  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-canvas)_78%,transparent)] px-[12px] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] sm:gap-4 sm:px-[22px]">
      {/* Mobile hamburger menu */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden flex items-center justify-center size-[36px] rounded-[10px] border border-transparent hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        <Icon name="Menu" size={16} />
      </button>

      {/* Search (command palette deferred — input is inert for now) */}
      <label className="flex h-[32px] min-w-0 max-w-[280px] flex-1 items-center gap-2 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-[11px] text-[13px] text-[var(--color-muted)] transition-colors hover:border-[var(--accent-line)] hover:bg-[var(--color-surface-3)] focus-within:border-[var(--accent-line)] focus-within:bg-[var(--color-surface-3)] sm:max-w-[280px]">
        <Icon name="Search" size={15} />
        <input
          placeholder="Search sessions, repos, agents…"
          className="w-full bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-faint)] focus:outline-none text-[13px]"
        />
        <kbd className="hidden text-[10px] text-[var(--color-muted)] border border-[var(--color-line-2)] rounded-[5px] px-[5px] py-[1px] bg-[var(--color-canvas)] font-mono">⌘K</kbd>
      </label>

      <div className="ml-auto flex shrink-0 items-center gap-[6px]">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => toggle("bell")}
            className="relative grid size-[36px] place-items-center rounded-[10px] border border-transparent bg-transparent text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)] hover:border-[var(--color-line)]"
          >
            <Icon name="Bell" size={16} />
            {count > 0 && (
              <span className="absolute top-2 right-2 grid size-[20px] place-items-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
          <Dropdown open={open === "bell"} onClose={close} width="w-64">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[12px] font-semibold text-[var(--color-ink)]">Notifications</span>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <button onClick={clearNotifications} className="text-[11px] font-medium text-[var(--color-faint)] hover:text-[var(--color-ink)]">
                    Clear
                  </button>
                )}
                <Link href="/logs" onClick={close} className="text-[11px] font-medium text-[var(--accent)] hover:underline">
                  View all
                </Link>
              </div>
            </div>
            <div className="my-1 border-t border-[var(--color-line)]" />
            {count === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-[var(--color-faint)]">No recent activity.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {visibleNotifications.slice(0, 8).map((n) => {
                  const accent = n.agentId ? AGENTS[n.agentId].accent : "var(--accent)";
                  const icon = n.agentId ? AGENTS[n.agentId].icon : n.icon;
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.agentId ? `/agents/${n.agentId}` : "/logs"}
                        onClick={close}
                        className="flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-[var(--color-surface-hover)]"
                      >
                        <span
                          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[7px] border border-[var(--color-line)]"
                          style={{ color: accent, background: `color-mix(in srgb, ${accent} 15%, var(--color-surface))` }}
                        >
                          <Icon name={icon} size={12} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--color-ink-2)]">{n.text}</span>
                        <span className="shrink-0 text-[10px] text-[var(--color-faint)]">{n.when}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Dropdown>
        </div>

        {/* New session button */}
        <button className="flex items-center gap-2 rounded-[10px] border border-transparent bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] px-[13px] py-2 text-[13px] font-[550] text-white transition-colors hover:brightness-110 shadow-[0_8px_22px_-12px_var(--accent)_inset_0_1px_0_rgba(255,255,255,0.3)]">
          <Icon name="Plus" size={15} />
          <span className="hidden sm:inline">New session</span>
        </button>
      </div>
    </header>
  );
}
