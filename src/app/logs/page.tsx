import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Level = "info" | "warn" | "error" | "ok";

const LOGS: { ts: string; level: Level; source: string; msg: string }[] = [
  { ts: "10:24:03", level: "info", source: "claude-code", msg: "Session refuelr-chapter-12 started on feat/query-optimizations" },
  { ts: "10:24:09", level: "ok", source: "claude-code", msg: "Added composite index on (user_id, created_at)" },
  { ts: "10:24:18", level: "ok", source: "claude-code", msg: "All tests passed (42/42)" },
  { ts: "10:23:11", level: "info", source: "codex", msg: "feat/social-login — compiled 742 modules in 1.8s" },
  { ts: "10:22:54", level: "warn", source: "api-services", msg: "Elevated p95 latency on /orders (612ms)" },
  { ts: "10:21:07", level: "info", source: "hermes", msg: "Job optimize-database-queries: 3/6 generate recommendations" },
  { ts: "10:20:40", level: "ok", source: "github", msg: "Synced 3 repositories" },
  { ts: "10:19:02", level: "error", source: "data-pipeline", msg: "Retry 2/3: connection reset while ingesting events" },
  { ts: "10:18:33", level: "info", source: "obsidian", msg: "Indexed 1,284 notes, created 31 backlinks" },
];

const LEVEL_TONE: Record<Level, string> = {
  info: "text-info",
  warn: "text-warn",
  error: "text-danger",
  ok: "text-ok",
};

export default function LogsPage() {
  return (
    <>
      <PageHeader title="Logs" subtitle="Unified event stream across agents and integrations." icon="ScrollText" />
      <Card className="overflow-hidden p-0">
        <div className="max-h-[70vh] overflow-auto bg-[#080a0d] p-4 font-mono text-[12.5px] leading-6">
          {LOGS.map((l, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 text-faint">{l.ts}</span>
              <span className={cn("w-12 shrink-0 font-semibold uppercase", LEVEL_TONE[l.level])}>{l.level}</span>
              <span className="shrink-0 text-[var(--accent)]">{l.source}</span>
              <span className="text-muted">{l.msg}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
