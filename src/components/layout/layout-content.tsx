"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";
import type { ActivityItem } from "@/lib/types";

export function LayoutContent({
  agentStatuses,
  notifications,
  systemState,
  children,
}: {
  agentStatuses: Record<string, "online" | "offline" | "running" | "degraded">;
  notifications: ActivityItem[];
  systemState: { state: "healthy" | "running" | "degraded" | "down"; label: string };
  children: React.ReactNode;
}) {
  const { isOpen, toggle, close } = useMobileSidebar();

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden lg:grid h-screen" style={{ gridTemplateColumns: "240px 1fr" }}>
        <Sidebar agentStatuses={agentStatuses} />
        <div className="flex min-w-0 flex-col" style={{ height: "100vh" }}>
          <TopBar
            notifications={notifications}
            systemState={systemState.state}
            systemLabel={systemState.label}
          />
          <main className="flex-1 overflow-y-auto px-[20px] py-[20px] pb-14 xl:px-[24px]">
            <div className="mx-auto max-w-[1320px]">{children}</div>
          </main>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden flex h-screen flex-col">
        <TopBar
          notifications={notifications}
          systemState={systemState.state}
          systemLabel={systemState.label}
          onToggleSidebar={toggle}
        />
        <main className="flex-1 overflow-y-auto px-[14px] py-[14px] pb-14 sm:px-[16px] sm:py-[16px]">
          <div className="mx-auto max-w-[1320px]">{children}</div>
        </main>

        {/* Mobile sidebar drawer overlay */}
        {isOpen && (
          <>
            <div
              className="overlay-enter fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px]"
              onClick={close}
            />
            <div className="drawer-enter fixed inset-y-0 left-0 z-40 w-[252px] overflow-hidden border-r border-[var(--color-line)] bg-[var(--color-canvas-2)] shadow-[0_30px_70px_-34px_rgba(0,0,0,0.95)]">
              <Sidebar agentStatuses={agentStatuses} mobile onNavigate={close} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
