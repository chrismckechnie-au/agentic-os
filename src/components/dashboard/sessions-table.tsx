import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { AgentTag } from "@/components/dashboard/agent-tag";
import { Icon } from "@/components/icon";
import type { Session } from "@/lib/types";

export function SessionsTable({ sessions }: { sessions: Session[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]">
          <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wider text-faint">
            <th className="px-5 py-3 font-medium">Session Title</th>
            <th className="px-5 py-3 font-medium">Agent</th>
            <th className="px-5 py-3 font-medium">Workspace</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 text-right font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={`${s.agentId}-${s.id}`}
              className="group border-b border-line/60 last:border-0 transition-colors hover:bg-surface-2/70"
            >
              <td className="px-5 py-4">
                <Link href={`/agents/${s.agentId}?session=${s.id}`} className="flex items-center gap-2.5 font-medium text-ink">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-line bg-surface-2 text-faint transition-colors group-hover:border-[var(--accent-line)] group-hover:text-[var(--accent)]">
                    <Icon name="MessageSquare" size={14} />
                  </span>
                  <span className="truncate">{s.title}</span>
                </Link>
              </td>
              <td className="px-5 py-4">
                <AgentTag id={s.agentId} />
              </td>
              <td className="px-5 py-4 text-muted">{s.workspace ?? "—"}</td>
              <td className="px-5 py-4">
                <StatusBadge status={s.status} />
              </td>
              <td className="px-5 py-4 text-right text-faint">{s.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
