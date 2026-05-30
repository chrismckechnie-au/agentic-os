"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { AGENTS } from "@/lib/config/agents";
import type { ActivityItem } from "@/lib/types";

function Dropdown({
  open,
  onClose,
  children,
  width = "min-w-56",
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
      <div className={`absolute right-0 top-11 z-20 rounded-lg border border-line bg-surface py-1 shadow-lg ${width}`}>
        {children}
      </div>
    </>
  );
}

export function TopBar({ notifications = [] }: { notifications?: ActivityItem[] }) {
  const [open, setOpen] = useState<"org" | "bell" | "avatar" | null>(null);
  const toggle = (m: "org" | "bell" | "avatar") => setOpen((v) => (v === m ? null : m));
  const close = () => setOpen(null);
  const count = notifications.length;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-canvas/70 px-6 backdrop-blur">
      {/* Search (command palette deferred — input is inert for now) */}
      <label className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 text-sm text-faint">
        <Icon name="Search" size={16} />
        <input
          placeholder="Search anything..."
          className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none"
        />
      </label>

      <div className="ml-auto flex items-center gap-3">
        {/* Org switcher */}
        <div className="relative hidden sm:block">
          <button
            onClick={() => toggle("org")}
            className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink transition-colors hover:bg-surface-3"
          >
            <Icon name="Boxes" size={15} className="text-muted" />
            Acme Corp
            <Icon name="ChevronDown" size={14} className="text-faint" />
          </button>
          <Dropdown open={open === "org"} onClose={close}>
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Organization</p>
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-ink">
              <span className="grid size-5 place-items-center rounded bg-[var(--accent)] text-[10px] font-bold text-white">A</span>
              Acme Corp
              <Icon name="CircleCheck" size={14} className="ml-auto text-ok" />
            </div>
            <div className="my-1 border-t border-line" />
            <Link href="/settings" onClick={close} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-3">
              <Icon name="Settings" size={14} className="text-muted" /> Organization settings
            </Link>
          </Dropdown>
        </div>

        {/* System status */}
        <span className="hidden h-9 items-center gap-2 rounded-lg border border-ok/25 bg-ok/10 px-3 text-sm font-medium text-ok md:flex">
          <span className="size-2 rounded-full bg-ok animate-pulse" />
          System Healthy
        </span>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => toggle("bell")}
            className="relative grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-muted transition-colors hover:text-ink"
          >
            <Icon name="Bell" size={17} />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
          <Dropdown open={open === "bell"} onClose={close} width="w-80">

            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-xs font-semibold text-ink">Notifications</span>
              <Link href="/logs" onClick={close} className="text-[11px] font-medium text-[var(--accent)] hover:underline">
                View all
              </Link>
            </div>
            <div className="my-1 border-t border-line" />
            {count === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-faint">No recent activity.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {notifications.slice(0, 8).map((n) => {
                  const accent = n.agentId ? AGENTS[n.agentId].accent : "var(--accent)";
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.agentId ? `/agents/${n.agentId}` : "/logs"}
                        onClick={close}
                        className="flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-surface-3"
                      >
                        <span
                          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-line"
                          style={{ color: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
                        >
                          <Icon name={n.icon} size={12} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{n.text}</span>
                        <span className="shrink-0 text-[10px] text-faint">{n.when}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Dropdown>
        </div>

        {/* Avatar */}
        <div className="relative">
          <button
            onClick={() => toggle("avatar")}
            className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pl-1 pr-2 transition-colors hover:bg-surface-3"
          >
            <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-[#7c6cff] to-[#9d7cff] text-xs font-bold text-white">
              CM
            </span>
            <Icon name="ChevronDown" size={14} className="text-faint" />
          </button>
          <Dropdown open={open === "avatar"} onClose={close}>
            <div className="flex items-center gap-2.5 px-3 py-2">
              <span className="grid size-8 place-items-center rounded-md bg-gradient-to-br from-[#7c6cff] to-[#9d7cff] text-xs font-bold text-white">CM</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">Chris McKechnie</p>
                <p className="truncate text-[11px] text-faint">chris.mckechnie@gmail.com</p>
              </div>
            </div>
            <div className="my-1 border-t border-line" />
            <Link href="/settings" onClick={close} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-3">
              <Icon name="User" size={14} className="text-muted" /> Profile
            </Link>
            <Link href="/settings" onClick={close} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-3">
              <Icon name="Settings" size={14} className="text-muted" /> Settings
            </Link>
            <div className="my-1 border-t border-line" />
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted hover:bg-surface-3">
              <Icon name="LogOut" size={14} /> Sign out
            </button>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
