import { HealthDot } from "@/components/ui/badge";
import type { HealthItem } from "@/lib/types";

const LABEL: Record<HealthItem["status"], string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  running: "Running",
};

const TEXT: Record<HealthItem["status"], string> = {
  healthy: "text-ok",
  degraded: "text-warn",
  down: "text-danger",
  running: "text-info",
};

export function HealthList({ items }: { items: HealthItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => (
        <li key={it.label} className="flex items-center justify-between py-2.5 text-sm">
          <span className="flex items-center gap-2.5">
            <HealthDot status={it.status} />
            <span className="text-muted">{it.label}</span>
          </span>
          <span className={`flex items-center gap-2 font-medium ${TEXT[it.status]}`}>
            {it.detail && <span className="text-faint">{it.detail}</span>}
            {LABEL[it.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
