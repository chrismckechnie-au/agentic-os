import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { AgentTag } from "@/components/dashboard/agent-tag";
import { Icon } from "@/components/icon";
import type { Session } from "@/lib/types";

export function SessionsTable({ sessions }: { sessions: Session[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium text-faint">
            <th className="px-4 py-2.5 font-medium">Session Title</th>
            <th className="px-4 py-2.5 font-medium">Agent</th>
            <th className="px-4 py-2.5 font-medium">Workspace</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 text-right font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={`${s.agentId}-${s.id}`}
              className="group border-b border-line/60 last:border-0 transition-colors hover:bg-surface-2/50"
            >
              <td className="px-4 py-3">
                <Link href={`/agents/${s.agentId}`} className="flex items-center gap-2 font-medium text-ink">
                  <Icon name="MessageSquare" size={14} className="text-faint" />
                  <span className="truncate">{s.title}</span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <AgentTag id={s.agentId} />
              </td>
              <td className="px-4 py-3 text-muted">{s.workspace}</td>
              <td className="px-4 py-3">
                <StatusBadge status={s.status} />
              </td>
              <td className="px-4 py-3 text-right text-faint">{s.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
