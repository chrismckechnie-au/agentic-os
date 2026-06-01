import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { HERMES_CREW_ROLE_LABELS } from "@/lib/config/hermes-crew";
import { cn } from "@/lib/utils";
import type { HermesCrewDashboard, HermesCrewJob, HermesCrewProfile } from "@/lib/types";

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "muted" | "info"> = {
  running: "ok",
  online: "ok",
  completed: "ok",
  attention: "warn",
  queued: "info",
  paused: "muted",
  idle: "muted",
  missing: "danger",
  failed: "danger",
};

function toneFor(status: string): "ok" | "warn" | "danger" | "muted" | "info" {
  return STATUS_TONE[status] ?? "muted";
}

function CrewCard({ profile }: { profile: HermesCrewProfile }) {
  return (
    <div className="tile min-w-0 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{profile.name}</span>
            <Badge tone={toneFor(profile.status)}>{profile.status}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-faint">{HERMES_CREW_ROLE_LABELS[profile.role]}</p>
        </div>
        <Icon name={profile.role === "incidents" ? "ShieldCheck" : profile.role === "social" ? "SendHorizontal" : "Workflow"} size={16} className="shrink-0 text-[var(--accent)]" />
      </div>

      <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-4 text-muted">{profile.description}</p>

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5">
          <div className="text-sm font-semibold text-ink">{profile.openTasks}</div>
          <div className="text-[10px] text-faint">open</div>
        </div>
        <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5">
          <div className="text-sm font-semibold text-ink">{profile.runningTasks}</div>
          <div className="text-[10px] text-faint">running</div>
        </div>
        <div className="rounded-md border border-line bg-surface-2 px-2 py-1.5">
          <div className={cn("text-sm font-semibold", profile.attentionCount > 0 ? "text-warn" : "text-ink")}>
            {profile.attentionCount}
          </div>
          <div className="text-[10px] text-faint">flags</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] text-faint">
        <div className="flex items-center justify-between gap-2">
          <span>model</span>
          <span className="min-w-0 truncate font-mono text-muted">{profile.model}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>private</span>
          <span className={cn("min-w-0 truncate font-mono", profile.privateChannel.available ? "text-muted" : "text-danger")}>
            #{profile.privateChannel.name}
          </span>
        </div>
      </div>
    </div>
  );
}

function JobRow({ job }: { job: HermesCrewJob }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium text-muted">{job.name}</span>
        <span className="block truncate font-mono text-[11px] text-faint">
          {job.schedule ?? "manual"} {job.deliver ? `· ${job.deliver}` : ""}
        </span>
        {job.lastError && <span className="mt-1 block line-clamp-2 text-xs text-danger">{job.lastError}</span>}
      </span>
      <Badge tone={toneFor(job.status)}>{job.status}</Badge>
    </li>
  );
}

function CapabilityPill({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        enabled ? "border-ok/25 bg-ok/10 text-ok" : "border-line bg-surface-2 text-faint",
      )}
    >
      <span className={cn("size-1.5 rounded-full", enabled ? "bg-ok" : "bg-faint")} />
      {label}
    </span>
  );
}

export function HermesMissionControl({
  dashboard,
  framed = false,
}: {
  dashboard: HermesCrewDashboard;
  framed?: boolean;
}) {
  const failedJobs = dashboard.jobs.filter((job) => job.status === "failed");
  const visibleJobs = [...failedJobs, ...dashboard.jobs.filter((job) => job.status !== "failed")].slice(0, 6);
  const rootClass = framed ? "panel" : "";

  return (
    <section className={cn(rootClass, framed ? "p-5" : "space-y-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="Workflow" size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-ink">Hermes Mission Control</h2>
          </div>
          <p className="mt-1 text-xs text-faint">
            {dashboard.activeProfile ?? "default"} · Discord {dashboard.gateway.discord} · {dashboard.stats.availableProfiles}/{dashboard.stats.profiles} profiles ready
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CapabilityPill enabled={dashboard.actions.kanbanWritesEnabled} label="Kanban actions" />
          <CapabilityPill enabled={dashboard.actions.cronActionsEnabled} label="Cron actions" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="tile px-3 py-2">
          <div className="text-lg font-semibold text-ink">{dashboard.stats.openTasks}</div>
          <div className="text-[11px] text-faint">open tasks</div>
        </div>
        <div className="tile px-3 py-2">
          <div className="text-lg font-semibold text-ink">{dashboard.stats.runningTasks}</div>
          <div className="text-[11px] text-faint">running</div>
        </div>
        <div className="tile px-3 py-2">
          <div className={cn("text-lg font-semibold", dashboard.stats.failedJobs > 0 ? "text-danger" : "text-ink")}>
            {dashboard.stats.failedJobs}
          </div>
          <div className="text-[11px] text-faint">failed jobs</div>
        </div>
        <div className="tile px-3 py-2">
          <div className={cn("text-lg font-semibold", dashboard.stats.missingPrivateChannels > 0 ? "text-warn" : "text-ink")}>
            {dashboard.stats.missingPrivateChannels}
          </div>
          <div className="text-[11px] text-faint">channel gaps</div>
        </div>
      </div>

      {dashboard.attention.length > 0 && (
        <div className="mt-4 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warn">
            <Icon name="Bell" size={13} /> Attention
          </div>
          <ul className="space-y-1 text-xs text-muted">
            {dashboard.attention.slice(0, 4).map((item) => (
              <li key={item} className="line-clamp-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <div className="grid gap-3 lg:col-span-3 sm:grid-cols-2 xl:grid-cols-3">
          {dashboard.crew.map((profile) => (
            <CrewCard key={profile.id} profile={profile} />
          ))}
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="tile p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Automation</span>
              <Link href="/agents/hermes" className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
                Hermes <Icon name="ArrowRight" size={12} />
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {visibleJobs.length === 0 ? (
                <li className="py-4 text-center text-xs text-faint">No cron jobs detected</li>
              ) : (
                visibleJobs.map((job) => <JobRow key={job.id} job={job} />)
              )}
            </ul>
          </div>

          <div className="tile p-3">
            <span className="text-sm font-semibold text-ink">Recent Crew Activity</span>
            <ul className="mt-2 space-y-2">
              {dashboard.activity.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-xs">
                  <Icon name={item.source === "cron" ? "Clock" : item.source === "kanban" ? "SquareKanban" : "CircleDot"} size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-muted">{item.title}</span>
                    <span className="block truncate text-faint">{item.when}</span>
                  </span>
                  {item.status && <Badge tone={toneFor(item.status)}>{item.status}</Badge>}
                </li>
              ))}
              {dashboard.activity.length === 0 && <li className="py-3 text-center text-xs text-faint">No crew activity detected</li>}
            </ul>
          </div>
        </div>
      </div>

      {dashboard.documents.length > 0 && (
        <div className="mt-3 tile p-3">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="BookOpen" size={14} className="text-[var(--accent)]" />
            <span className="text-sm font-semibold text-ink">Obsidian Crew Library</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.documents.slice(0, 6).map((doc) => (
              <div key={doc.id} className="rounded-md border border-line bg-surface-2 px-2.5 py-2 text-xs">
                <div className="truncate font-medium text-muted">{doc.title}</div>
                <div className="mt-1 truncate font-mono text-faint">{doc.path}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
