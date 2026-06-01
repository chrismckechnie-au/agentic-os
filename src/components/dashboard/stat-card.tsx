import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
import type { StatMetric } from "@/lib/types";

export function StatCard({ stat }: { stat: StatMetric }) {
  const trendColor =
    stat.trend === "down" ? "text-danger" : stat.trend === "up" ? "text-ok" : "text-muted";
  const meterColor =
    typeof stat.meterPct === "number" && stat.meterPct >= 90
      ? "#f87171"
      : typeof stat.meterPct === "number" && stat.meterPct >= 75
        ? "#f59e0b"
        : "var(--accent)";

  return (
    <Card className="p-4">
      <div className="flex min-h-5 items-center gap-2 text-muted">
        {stat.icon && (
          <span className="flex size-4 shrink-0 items-center justify-center text-[var(--accent)]">
            <Icon name={stat.icon} size={16} />
          </span>
        )}
        <span className="text-xs font-medium leading-none">{stat.label}</span>
      </div>

      <div className="mt-2.5 text-3xl font-bold tracking-tight tabular-nums">{stat.value}</div>

      {typeof stat.meterPct === "number" && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.max(0, Math.min(100, stat.meterPct))}%`,
                background: meterColor,
                boxShadow: `0 0 10px color-mix(in srgb, ${meterColor} 58%, transparent)`,
              }}
            />
          </div>
          {stat.meterLabel && <div className="mt-1.5 text-[10.5px] text-faint">{stat.meterLabel}</div>}
        </div>
      )}

      <div className="mt-1 flex items-end justify-between gap-2">
        {stat.delta ? (
          <span className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
            {stat.trend && (
              <Icon name="ArrowUpRight" size={13} className={cn(stat.trend === "down" && "rotate-90")} />
            )}
            {stat.delta}
          </span>
        ) : (
          <span className="text-xs text-faint">{stat.hint}</span>
        )}
        {stat.spark && <Sparkline data={stat.spark} className="opacity-90" />}
      </div>
    </Card>
  );
}
