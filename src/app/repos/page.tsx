export const dynamic = "force-dynamic";

import { getProvider } from "@/lib/providers";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";

export default async function ReposPage() {
  const repos = await getProvider().listRepos();

  return (
    <>
      <PageHeader
        title="Repositories"
        subtitle="All repositories connected via GitHub, with agent activity."
        icon="FolderGit2"
        right={
          <label className="flex h-9 w-64 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm">
            <Icon name="Search" size={15} className="text-faint" />
            <input placeholder="Find a repository..." className="w-full bg-transparent text-ink placeholder:text-faint focus:outline-none" />
          </label>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {repos.map((r) => (
          <Card key={r.id} className="flex flex-col p-5 transition-colors hover:border-line-strong">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon name="FolderGit2" size={16} className="text-[var(--accent)]" />
                <span className="font-semibold text-ink">{r.name}</span>
              </div>
              <Badge tone="muted">{r.private ? "Private" : "Public"}</Badge>
            </div>

            <p className="mt-1 text-xs text-faint">{r.owner}</p>
            <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{r.description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: r.languageColor }} />
                {r.language}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="Star" size={13} /> {r.stars}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="GitFork" size={13} /> {r.forks}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="GitPullRequest" size={13} /> {r.openPRs}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="CircleDot" size={13} /> {r.openIssues}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-faint">
              <span className="flex items-center gap-1.5">
                <Icon name="GitBranch" size={13} /> {r.defaultBranch}
              </span>
              <span>Updated {r.pushedAt}</span>
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
