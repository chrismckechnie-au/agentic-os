import { Icon } from "@/components/icon";

export function PageHeader({
  title,
  subtitle,
  icon,
  accent,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  accent?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span
            className="grid size-11 place-items-center rounded-xl border border-line"
            style={{
              color: accent ?? "var(--accent)",
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            }}
          >
            <Icon name={icon} size={22} />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
