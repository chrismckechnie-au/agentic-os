export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHermesCrewDashboard } from "@/lib/providers";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import type { HermesCrewProfileStatus, HermesCrewRole } from "@/lib/types";

function roleIcon(role: HermesCrewRole): string {
  switch (role) {
    case "engineering":
      return "Cpu";
    case "incidents":
      return "ShieldCheck";
    case "social":
      return "SendHorizontal";
    case "research":
      return "BookOpen";
    default:
      return "Workflow";
  }
}

function profileTone(status: HermesCrewProfileStatus): "ok" | "info" | "warn" | "danger" | "muted" {
  switch (status) {
    case "running":
      return "ok";
    case "online":
      return "info";
    case "attention":
      return "warn";
    case "missing":
      return "danger";
    default:
      return "muted";
  }
}

function profileLabel(status: HermesCrewProfileStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "online":
      return "Online";
    case "attention":
      return "Attention";
    case "missing":
      return "Missing";
    default:
      return "Idle";
  }
}

export default async function CommandCenterPage() {
  const hermes = await getHermesCrewDashboard();

  const metrics = [
    { label: "Profiles", value: String(hermes.stats.profiles), hint: `${hermes.stats.availableProfiles} available`, icon: "Cpu" },
    { label: "Open Tasks", value: String(hermes.stats.openTasks), hint: `${hermes.stats.runningTasks} running`, icon: "Target" },
    { label: "Failed Jobs", value: String(hermes.stats.failedJobs), hint: "Cron attention", icon: "ShieldCheck" },
    { label: "Channels", value: String(hermes.channels.filter((channel) => channel.available).length), hint: `${hermes.stats.missingPrivateChannels} private missing`, icon: "MessageSquare" },
  ];

  return (
    <div className="mx-auto max-w-[1320px]">
      <PageHeader
        title="Hermes Command Center"
        subtitle="Mission control for crew health, active jobs, and recent dispatch activity."
        icon="HermesLogo"
        accent="#a855f7"
        right={(
          <>
            <Link
              href="/agents/hermes"
              className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <Icon name="Cpu" size={14} />
              Hermes
            </Link>
            <Link
              href="/kanban"
              className="inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-medium text-white"
              style={{
                background: "linear-gradient(150deg, #a855f7, #c084fc)",
                boxShadow: "0 10px 26px -12px rgba(168,85,247,0.9), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <Icon name="SquareKanban" size={14} />
              Kanban
            </Link>
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-4">
            <div className="flex items-center gap-2 text-muted">
              <span className="flex size-4 shrink-0 items-center justify-center text-[var(--accent)]">
                <Icon name={metric.icon} size={16} />
              </span>
              <span className="text-xs font-medium leading-none">{metric.label}</span>
            </div>
            <div className="mt-2.5 text-3xl font-bold tracking-tight tabular-nums">{metric.value}</div>
            <div className="mt-3 text-xs text-faint">{metric.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Gateway</CardTitle>
                <p className="mt-1 text-xs text-faint">Current Hermes runtime and channel connectivity.</p>
              </div>
              <Badge tone={hermes.gateway.state === "running" ? "ok" : hermes.gateway.state === "stopped" ? "danger" : "muted"}>
                {hermes.gateway.state}
              </Badge>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-3 pt-0 md:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface-2 p-3">
                <div className="text-[11px] uppercase tracking-wider text-faint">Discord</div>
                <div className="mt-2 text-sm font-semibold text-ink">{hermes.gateway.discord}</div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-3">
                <div className="text-[11px] uppercase tracking-wider text-faint">Webhook</div>
                <div className="mt-2 text-sm font-semibold text-ink">{hermes.gateway.webhook}</div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-3">
                <div className="text-[11px] uppercase tracking-wider text-faint">Active Agents</div>
                <div className="mt-2 text-sm font-semibold text-ink">{hermes.gateway.activeAgents}</div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Crew</CardTitle>
                <p className="mt-1 text-xs text-faint">Profiles, private channels, and active task load.</p>
              </div>
              <Badge tone="violet">{hermes.activeProfile ?? "No active profile"}</Badge>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="divide-y divide-line">
                {hermes.crew.map((profile) => (
                  <div key={profile.id} className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-[var(--accent)]">
                      <Icon name={roleIcon(profile.role)} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{profile.name}</span>
                        <Badge tone={profileTone(profile.status)}>{profileLabel(profile.status)}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-faint">{profile.description}</div>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
                        <span>{profile.model}</span>
                        <span>{profile.openTasks} open</span>
                        <span>{profile.runningTasks} running</span>
                        <span>{profile.privateChannel.available ? `#${profile.privateChannel.name}` : "private channel missing"}</span>
                        {profile.lastActivity && <span>{profile.lastActivity}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dispatch Activity</CardTitle>
              <Link href="/logs" className="text-xs font-medium text-[var(--accent)] hover:underline">
                View logs
              </Link>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="divide-y divide-line">
                {hermes.activity.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[var(--accent)]">
                      <Icon name={entry.source === "cron" ? "Calendar" : entry.source === "kanban" ? "SquareKanban" : "Workflow"} size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-ink">{entry.title}</div>
                      {entry.summary && <div className="mt-1 line-clamp-2 text-xs text-faint">{entry.summary}</div>}
                    </div>
                    <div className="shrink-0 text-[11px] text-faint">{entry.when}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Jobs</CardTitle>
              <Link href="/agents/hermes" className="text-xs font-medium text-[var(--accent)] hover:underline">
                Hermes page
              </Link>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-3">
                {hermes.jobs.slice(0, 6).map((job) => (
                  <div key={job.id} className="rounded-xl border border-line bg-surface-2 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{job.name}</div>
                        <div className="mt-1 text-[11px] text-faint">{job.schedule ?? "Manual run"}</div>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                    {job.lastError && <div className="mt-2 text-xs text-danger">{job.lastError}</div>}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attention</CardTitle>
              <Badge tone={hermes.attention.length > 0 ? "warn" : "ok"}>
                {hermes.attention.length === 0 ? "Clear" : `${hermes.attention.length} items`}
              </Badge>
            </CardHeader>
            <CardBody className="pt-0">
              {hermes.attention.length === 0 ? (
                <div className="text-sm text-faint">No active attention items.</div>
              ) : (
                <ul className="space-y-2">
                  {hermes.attention.slice(0, 8).map((item) => (
                    <li key={item} className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <Badge tone="muted">{hermes.documents.length}</Badge>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-3">
                {hermes.documents.slice(0, 6).map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-line bg-surface-2 p-3">
                    <div className="text-sm font-semibold text-ink">{doc.title}</div>
                    <div className="mt-1 text-[11px] text-faint">{doc.path}</div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted">
                      <span>{doc.kind}</span>
                      <span>{doc.updatedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
