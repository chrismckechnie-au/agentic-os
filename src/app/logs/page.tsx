export const dynamic = "force-dynamic";

import { buildActivity } from "@/lib/activity/real";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

type Level = "info" | "warn" | "error" | "ok";

const ICON_TO_LEVEL: Record<string, Level> = {
  CircleCheck: "ok",
  Activity: "info",
  MessageSquare: "info",
};

export default function LogsPage() {
  const activity = buildActivity(50);

  const logs = activity.map((item) => ({
    when: item.when,
    level: (ICON_TO_LEVEL[item.icon] ?? "info") as Level,
    source: item.agentId ?? "system",
    msg: item.text,
  }));

  const LEVEL_TONE: Record<Level, string> = {
    info: "text-info",
    warn: "text-warn",
    error: "text-danger",
    ok: "text-ok",
  };

  return (
    <>
      <PageHeader
        title="Logs"
        subtitle="Unified event stream across agents and integrations."
        icon="ScrollText"
        right={
          <>
            <span className="ghost-btn text-[11px] uppercase tracking-wider text-faint">All levels</span>
            <span className="ghost-btn text-[11px] uppercase tracking-wider text-faint">Follow stream</span>
          </>
        }
      />
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon name="Activity" size={14} className="text-[var(--accent)]" />
            Event console
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-[11px] font-semibold text-ok">
            <span className="size-1.5 animate-pulse rounded-full bg-ok" />
            Live tail
          </span>
        </div>
        <div className="max-h-[70vh] overflow-auto bg-[#080a0d] p-4 font-mono text-[12.5px] leading-6">
          {logs.length === 0 ? (
            <span className="text-faint">No recent activity.</span>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="flex gap-3 rounded-[10px] px-2 py-1 transition-colors hover:bg-white/[0.03]">
                <span className="shrink-0 text-faint">{l.when}</span>
                <span className={cn("w-12 shrink-0 font-semibold uppercase", LEVEL_TONE[l.level])}>{l.level}</span>
                <span className="shrink-0 text-[var(--accent)]">{l.source}</span>
                <span className="text-muted">{l.msg}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}
