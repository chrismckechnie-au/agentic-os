import { Card } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
import type { StatMetric } from "@/lib/types";

export function StatCard({ stat }: { stat: StatMetric }) {
  const trendColor =
    stat.trend === "down" ? "text-danger" : stat.trend === "up" ? "text-ok" : "text-muted";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted">
        {stat.icon && (
          <span className="text-[var(--accent)]">
            <Icon name={stat.icon} size={16} />
          </span>
        )}
        <span className="text-xs font-medium">{stat.label}</span>
      </div>

      <div className="mt-2.5 text-3xl font-bold tracking-tight tabular-nums">{stat.value}</div>

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
