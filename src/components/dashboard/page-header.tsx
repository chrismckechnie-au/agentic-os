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
    <div className="mb-5 flex flex-col gap-4 md:mb-6 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-4 flex-1">
        {icon && (
          <span
            className="grid size-[46px] place-items-center rounded-[14px] border flex-none shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            style={{
              color: accent ?? "var(--accent-2)",
              background: accent ? `color-mix(in srgb, ${accent} 18%, transparent)` : "var(--accent-soft)",
              borderColor: accent ? `color-mix(in srgb, ${accent} 40%, transparent)` : "var(--accent-line)",
            }}
          >
            <Icon name={icon} size={22} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1">Workspace Surface</div>
          <h1 className="m-0 text-[24px] font-[675] -tracking-[0.03em] text-[var(--color-ink)] md:text-[27px]">{title}</h1>
          {subtitle && <p className="mb-0 mt-1 max-w-[780px] text-[13px] leading-6 text-[var(--color-muted)]">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2 md:flex-none">{right}</div>}
    </div>
  );
}
