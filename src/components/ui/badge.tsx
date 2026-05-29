import { cn } from "@/lib/utils";
import type { HealthStatus, SessionStatus } from "@/lib/types";

type Tone = "ok" | "info" | "violet" | "warn" | "danger" | "muted";

const TONE: Record<Tone, string> = {
  ok: "text-ok bg-ok/12 border-ok/25",
  info: "text-info bg-info/12 border-info/25",
  violet: "text-violet bg-violet/12 border-violet/25",
  warn: "text-warn bg-warn/12 border-warn/25",
  danger: "text-danger bg-danger/12 border-danger/25",
  muted: "text-muted bg-surface-2 border-line",
};

const STATUS_META: Record<SessionStatus, { tone: Tone; label: string }> = {
  active: { tone: "ok", label: "Active" },
  running: { tone: "ok", label: "Running" },
  completed: { tone: "ok", label: "Completed" },
  in_progress: { tone: "info", label: "In Progress" },
  reviewing: { tone: "violet", label: "Reviewing" },
  paused: { tone: "warn", label: "Paused" },
  queued: { tone: "muted", label: "Queued" },
  failed: { tone: "danger", label: "Failed" },
};

export function Badge({
  tone = "muted",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: SessionStatus; className?: string }) {
  const meta = STATUS_META[status];
  const live = status === "active" || status === "running";
  return (
    <Badge tone={meta.tone} className={className}>
      <span className={cn("size-1.5 rounded-full bg-current", live && "animate-pulse")} />
      {meta.label}
    </Badge>
  );
}

const HEALTH_TONE: Record<HealthStatus, Tone> = {
  healthy: "ok",
  degraded: "warn",
  down: "danger",
  running: "info",
};

export function HealthDot({ status }: { status: HealthStatus }) {
  const tone = HEALTH_TONE[status];
  const color = {
    ok: "bg-ok",
    info: "bg-info",
    warn: "bg-warn",
    danger: "bg-danger",
    violet: "bg-violet",
    muted: "bg-faint",
  }[tone];
  return <span className={cn("size-2 rounded-full", color)} />;
}

export function statusLabel(status: SessionStatus) {
  return STATUS_META[status].label;
}
