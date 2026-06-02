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
    <div className="mb-[22px] flex items-start gap-4">
      <div className="flex items-start gap-4 flex-1">
        {icon && (
          <span
            className="grid size-[42px] place-items-center rounded-[12px] border flex-none"
            style={{
              color: accent ?? "var(--color-accent-2)",
              background: accent ? `color-mix(in srgb, ${accent} 18%, transparent)` : "var(--color-accent-soft)",
              borderColor: accent ? `color-mix(in srgb, ${accent} 40%, transparent)` : "var(--color-accent-line)",
            }}
          >
            <Icon name={icon} size={21} />
          </span>
        )}
        <div className="flex-1">
          <h1 className="text-[21px] font-[650] -tracking-[0.02em] m-0">{title}</h1>
          {subtitle && <p className="text-[13px] text-[var(--color-muted)] mt-0.5 mb-0">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2 flex-none">{right}</div>}
    </div>
  );
}
