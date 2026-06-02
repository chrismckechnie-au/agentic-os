"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";

export function LayoutContent({
  agentStatuses,
  notifications,
  systemState,
  children,
}: {
  agentStatuses: Record<string, "online" | "offline" | "running" | "degraded">;
  notifications: any[];
  systemState: any;
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
          <main className="flex-1 overflow-y-auto px-[22px] py-[22px] pb-14">
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
        <main className="flex-1 overflow-y-auto px-[16px] py-[16px] pb-14">
          <div className="mx-auto max-w-[1320px]">{children}</div>
        </main>

        {/* Mobile sidebar drawer overlay */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/50"
              onClick={close}
            />
            <div className="fixed inset-y-0 left-0 z-40 w-[240px] overflow-y-auto bg-[var(--color-canvas)] border-r border-[var(--color-line)]">
              <Sidebar agentStatuses={agentStatuses} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
