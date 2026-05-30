export const dynamic = "force-dynamic";

import { buildActivity } from "@/lib/activity/real";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
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
      <PageHeader title="Logs" subtitle="Unified event stream across agents and integrations." icon="ScrollText" />
      <Card className="overflow-hidden p-0">
        <div className="max-h-[70vh] overflow-auto bg-[#080a0d] p-4 font-mono text-[12.5px] leading-6">
          {logs.length === 0 ? (
            <span className="text-faint">No recent activity.</span>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="flex gap-3">
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
