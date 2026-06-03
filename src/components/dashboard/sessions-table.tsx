import Link from "next/link";
import { AGENTS } from "@/lib/config/agents";
import { StatusBadge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import type { Session } from "@/lib/types";

export function SessionsTable({ sessions }: { sessions: Session[] }) {
  return (
    <>
      <div className="divide-y divide-line md:hidden">
        {sessions.map((session) => {
          const agent = AGENTS[session.agentId];
          const viewHref = `/agents/${session.agentId}?session=${session.id}`;
          const resumeHref = `${viewHref}&resume=1`;
          const resumable = Boolean(agent.liveCli);
          return (
            <div key={`${session.agentId}-${session.id}`} className="px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[11px] border border-line bg-surface-2 text-muted">
                  <Icon name={agent.icon} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={viewHref} className="block text-sm font-semibold text-ink">
                    <span className="line-clamp-2">{session.title}</span>
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-faint">
                    <span className="rounded-full border border-line bg-surface-2 px-2 py-1" title={agent.name}>
                      {agent.name}
                    </span>
                    <span className="rounded-full border border-line bg-surface-2 px-2 py-1">
                      {session.workspace ?? "—"}
                    </span>
                    <span>{session.updatedAt}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={session.status} />
                    <Link
                      href={viewHref}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-[var(--accent-line)] hover:text-ink"
                    >
                      <Icon name="ArrowUpRight" size={12} />
                      View
                    </Link>
                    {resumable && (
                      <Link
                        href={resumeHref}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-90"
                      >
                        <Icon name="Play" size={12} />
                        Resume
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
        <thead className="bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]">
          <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wider text-faint">
            <th className="px-5 py-3 font-medium">Session Title</th>
            <th className="px-5 py-3 font-medium">Agent</th>
            <th className="px-5 py-3 font-medium">Workspace</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Updated</th>
            <th className="px-5 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const agent = AGENTS[session.agentId];
            const viewHref = `/agents/${session.agentId}?session=${session.id}`;
            const resumeHref = `${viewHref}&resume=1`;
            const resumable = Boolean(agent.liveCli);
            return (
              <tr
                key={`${session.agentId}-${session.id}`}
                className="group border-b border-line/60 last:border-0 transition-colors hover:bg-surface-2/70"
              >
                <td className="px-5 py-4">
                  <Link href={viewHref} className="flex items-center gap-2.5 font-medium text-ink">
                    <span className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-line bg-surface-2 text-faint transition-colors group-hover:border-[var(--accent-line)] group-hover:text-[var(--accent)]">
                      <Icon name="MessageSquare" size={14} />
                    </span>
                    <span className="truncate">{session.title}</span>
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <span
                    className="grid size-8 place-items-center rounded-full border border-line bg-surface-2 text-muted"
                    title={agent.name}
                    aria-label={agent.name}
                  >
                    <Icon name={agent.icon} size={15} />
                  </span>
                </td>
                <td className="px-5 py-4 text-muted">{session.workspace ?? "—"}</td>
                <td className="px-5 py-4">
                  <StatusBadge status={session.status} />
                </td>
                <td className="px-5 py-4 text-faint">{session.updatedAt}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={viewHref}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-[var(--accent-line)] hover:text-ink"
                    >
                      <Icon name="ArrowUpRight" size={12} />
                      View
                    </Link>
                    {resumable && (
                      <Link
                        href={resumeHref}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-90"
                      >
                        <Icon name="Play" size={12} />
                        Resume
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </>
  );
}
