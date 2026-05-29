import Link from "next/link";
import { getProvider } from "@/lib/providers";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { OrchestrationPanel } from "@/components/dashboard/orchestration-panel";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { HealthList } from "@/components/dashboard/health-list";
import { SessionsTable } from "@/components/dashboard/sessions-table";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";

export default async function OverviewPage() {
  const data = await getProvider().getOverview();

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Monitor agents, sessions, and system health at a glance."
        icon="LayoutGrid"
        right={
          <div className="flex gap-2">
            <button
              className="flex h-[34px] items-center gap-2 rounded-[10px] border px-3 text-sm font-medium transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "var(--color-ink)" }}
            >
              <Icon name="RefreshCw" size={14} /> Refresh
            </button>
            <button
              className="flex h-[34px] items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-white transition-colors"
              style={{ background: "var(--accent)", boxShadow: "0 6px 20px -8px color-mix(in srgb, var(--accent) 70%, transparent)" }}
            >
              <Icon name="Plus" size={14} /> New Session
            </button>
          </div>
        }
      />

      {/* 5-col stat grid */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        {data.stats.map((s) => (
          <StatCard key={s.id} stat={s} />
        ))}
      </div>

      {/* Orchestration + Activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <OrchestrationPanel agents={data.agents} />

        <div className="panel">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <span className="text-sm font-semibold text-ink">Live Activity</span>
            <Link
              href="/logs"
              className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              View all <Icon name="ArrowRight" size={12} />
            </Link>
          </div>
          <div className="px-5 pb-5 pt-0">
            <ActivityFeed items={data.activity} />
          </div>
        </div>
      </div>

      {/* Recent Sessions + System Health + Workspaces */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="panel">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <span className="text-sm font-semibold text-ink">Recent Sessions</span>
            <Link
              href="/sessions"
              className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              All sessions <Icon name="ArrowRight" size={12} />
            </Link>
          </div>
          <SessionsTable sessions={data.recentSessions} />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <span className="flex items-center gap-1.5 text-xs font-medium text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Operational
              </span>
            </CardHeader>
            <CardBody className="pt-0">
              <HealthList items={data.health.slice(0, 6)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workspaces</CardTitle>
              <Link href="/workspaces" className="text-xs font-medium text-[var(--accent)] hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="divide-y divide-line">
                {data.workspaces.slice(0, 5).map((w) => (
                  <li key={w.name} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-2.5">
                      <Icon name="FolderGit2" size={15} className="text-muted" />
                      <span className="text-ink">{w.name}</span>
                    </span>
                    <span className="text-faint">
                      {w.agents} agent{w.agents === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
