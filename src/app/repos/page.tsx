export const dynamic = "force-dynamic";

import { getProvider } from "@/lib/providers";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import type { Repo } from "@/lib/types";

function repoBadge(repo: Repo): string {
  if (repo.metadataSource === "github" && repo.private) return "Private";
  if (repo.metadataSource === "github") return "Public";
  if (repo.metadataStatus === "unauthenticated") return "GitHub unavailable";
  if (repo.metadataStatus === "unavailable") return "GitHub unavailable";
  return "Local";
}

export default async function ReposPage() {
  const repos = await getProvider().listRepos();
  const privateCount = repos.filter((repo) => repo.private).length;
  const activeAgents = repos.reduce((total, repo) => total + (repo.agents ?? 0), 0);
  const githubLinked = repos.filter((repo) => repo.metadataSource === "github").length;

  return (
    <>
      <PageHeader
        title="Repositories"
        subtitle="Repositories discovered from live agent workspaces, with GitHub metadata when available."
        icon="FolderGit2"
        right={
          <label className="control-input w-full md:w-72">
            <Icon name="Search" size={15} className="text-faint" />
            <input placeholder="Find a repository..." className="text-sm" />
          </label>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Repositories" value={repos.length} icon="FolderGit2" />
        <MetricTile label="GitHub linked" value={githubLinked} icon="Github" />
        <MetricTile label="Private repos" value={privateCount} icon="Lock" />
        <MetricTile label="Agents attached" value={activeAgents} icon="Orbit" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {repos.map((r) => (
          <Card key={r.id} className="panel-hover flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="FolderGit2" size={16} className="text-[var(--accent)]" />
                <span className="font-semibold text-ink">{r.name}</span>
              </div>
              <Badge tone="muted">{repoBadge(r)}</Badge>
            </div>

            <p className="mt-1 text-xs text-faint">{r.owner}</p>
            {r.description && (
              <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{r.description}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint">
              {r.language && (
                <span className="flex items-center gap-1.5">
                  {r.languageColor && (
                    <span className="size-2.5 rounded-full" style={{ background: r.languageColor }} />
                  )}
                  {r.language}
                </span>
              )}
              {typeof r.stars === "number" && (
                <span className="flex items-center gap-1">
                  <Icon name="Star" size={13} /> {r.stars}
                </span>
              )}
              {typeof r.forks === "number" && (
                <span className="flex items-center gap-1">
                  <Icon name="GitFork" size={13} /> {r.forks}
                </span>
              )}
              {typeof r.openPRs === "number" && (
                <span className="flex items-center gap-1">
                  <Icon name="GitPullRequest" size={13} /> {r.openPRs}
                </span>
              )}
              {typeof r.openIssues === "number" && (
                <span className="flex items-center gap-1">
                  <Icon name="CircleDot" size={13} /> {r.openIssues}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-faint">
              <span className="flex items-center gap-1.5">
                <Icon name="GitBranch" size={13} /> {r.defaultBranch ?? "—"}
              </span>
              <span>{r.pushedAt ? `Updated ${r.pushedAt}` : "Updated —"}</span>
            </div>

            {typeof r.agents === "number" && r.agents > 0 && (
              <div className="mt-3">
                <span className="accent-chip inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium">
                  <Icon name="Activity" size={12} /> {r.agents} agent{r.agents === 1 ? "" : "s"} active
                </span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function MetricTile({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="tile px-4 py-3">
      <div className="flex items-center gap-2 text-[var(--color-faint)]">
        <Icon name={icon} size={14} className="text-[var(--accent)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-3 text-[26px] font-[660] leading-none tabular-nums text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
