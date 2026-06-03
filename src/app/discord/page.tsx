export const dynamic = "force-dynamic";

import { Icon } from "@/components/icon";

const DISCORD_COLOR = "#5865F2";

export default async function DiscordPage() {
  return (
    <div className="mx-auto max-w-[1320px]">
      <div
        className="panel mb-4 overflow-hidden p-5 md:p-6"
        style={{
          background: `
            radial-gradient(520px 220px at 92% -18%, color-mix(in srgb, ${DISCORD_COLOR} 20%, transparent), transparent 68%),
            linear-gradient(160deg, rgba(88,101,242,0.1), rgba(10,12,18,0.82) 58%)
          `,
          borderColor: `color-mix(in srgb, ${DISCORD_COLOR} 26%, var(--color-line))`,
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex size-[48px] items-center justify-center rounded-[14px] border flex-none"
              style={{
                background: `color-mix(in srgb, ${DISCORD_COLOR} 18%, transparent)`,
                borderColor: `color-mix(in srgb, ${DISCORD_COLOR} 40%, transparent)`,
                color: "#fff",
                boxShadow: `0 18px 36px -24px ${DISCORD_COLOR}`,
              }}
            >
              <Icon name="DiscordLogo" size={24} />
            </div>
            <div className="flex-1">
              <div className="eyebrow mb-1 text-[#a5b0ff]">Bridge Surface</div>
              <h1 className="m-0 text-[26px] font-[675] -tracking-[0.03em]">Discord</h1>
              <p className="mb-0 mt-1 max-w-[720px] text-[13px] leading-6 text-[var(--color-muted)]">
                Bridged to <strong>Agentic OS Crew</strong> for lane dispatch, operator handoffs, and notification delivery.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-3 py-1.5 text-[11px] font-semibold text-ok">
            <span className="size-1.5 rounded-full bg-ok" />
            Connected
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricTile label="Bridge" value="Online" icon="Cable" accent={DISCORD_COLOR} />
          <MetricTile label="Guilds" value="1" icon="Building2" accent={DISCORD_COLOR} />
          <MetricTile label="Agents routed" value="4" icon="Orbit" accent={DISCORD_COLOR} />
          <MetricTile label="Pending replies" value="3" icon="MessageSquareMore" accent={DISCORD_COLOR} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="text-sm font-semibold text-ink">Dispatch queue</div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-faint">
              Refuelr HQ
            </span>
          </div>
          <div className="divide-y divide-line">
            {[
              { title: "Escalate blocked diesel pricing thread", channel: "#ops-war-room", owner: "Hermes Incidents", status: "Awaiting operator context" },
              { title: "Post overnight canary summary", channel: "#builds", owner: "Hermes Research", status: "Queued for send" },
              { title: "Route repos digest to engineering", channel: "#engineering", owner: "Hermes Engineering", status: "Ready to dispatch" },
            ].map((item) => (
              <div key={item.title} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">{item.title}</div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--color-info)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_12%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-info">
                    <span className="size-1.5 rounded-full bg-info" />
                    {item.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-faint">
                  <span className="rounded-full border border-line bg-surface-2 px-2 py-1">{item.channel}</span>
                  <span className="rounded-full border border-line bg-surface-2 px-2 py-1">{item.owner}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <div className="text-sm font-semibold text-ink">Bridge health</div>
            <div className="mt-3 space-y-3 text-sm">
              {[
                { label: "Gateway heartbeat", value: "Stable" },
                { label: "Private routing", value: "Configured" },
                { label: "Webhook fanout", value: "3 active" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-[12px] border border-line bg-surface-2 px-3 py-2">
                  <span className="text-muted">{item.label}</span>
                  <span className="font-medium text-ink">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-sm font-semibold text-ink">Operator note</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              This route is still a control-plane placeholder, but it now matches the handoff shell and gives the bridge surface a credible status layout instead of an empty panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
}) {
  return (
    <div className="rounded-[14px] border px-4 py-3" style={{ background: "rgba(8, 10, 15, 0.36)", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
        <Icon name={icon} size={13} color={accent} />
        {label}
      </div>
      <div className="mt-3 text-[24px] font-[660] leading-none text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
