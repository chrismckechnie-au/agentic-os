import Link from "next/link";
import { getProvider } from "@/lib/providers";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { AgentCard } from "@/components/dashboard/agent-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { HealthList } from "@/components/dashboard/health-list";
import { SessionsTable } from "@/components/dashboard/sessions-table";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";

export default async function OverviewPage() {
  const data = await getProvider().getOverview();
  const featured = data.agents.filter((a) => a.status === "running").slice(0, 2);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Monitor agents, sessions, and system health at a glance."
        icon="LayoutGrid"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {data.stats.map((s) => (
          <StatCard key={s.id} stat={s} />
        ))}
      </div>

      {/* Agent overview + recent activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-muted">Agent Overview</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {featured.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <Link href="/logs" className="text-xs text-[var(--accent)] hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            <ActivityFeed items={data.activity} />
          </CardBody>
        </Card>
      </div>

      {/* Recent sessions + system status + workspaces */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <Link href="/sessions" className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
              View all sessions <Icon name="ArrowRight" size={13} />
            </Link>
          </CardHeader>
          <CardBody className="px-0 pb-0">
            <SessionsTable sessions={data.recentSessions} />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <span className="flex items-center gap-1.5 text-xs text-ok">
                <span className="size-1.5 rounded-full bg-ok" /> Operational
              </span>
            </CardHeader>
            <CardBody className="pt-0">
              <HealthList items={data.health.slice(0, 5)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workspaces</CardTitle>
              <Link href="/workspaces" className="text-xs text-[var(--accent)] hover:underline">
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
