export const dynamic = "force-dynamic";

import { Icon } from "@/components/icon";

const DISCORD_COLOR = "#5865F2";

export default async function DiscordPage() {
  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="flex items-start gap-4 mb-4">
        <div
          className="flex size-[42px] items-center justify-center rounded-[12px] border flex-none"
          style={{
            background: `color-mix(in srgb, ${DISCORD_COLOR} 18%, transparent)`,
            borderColor: `color-mix(in srgb, ${DISCORD_COLOR} 40%, transparent)`,
            color: "#fff",
          }}
        >
          <Icon name="DiscordLogo" size={22} />
        </div>
        <div className="flex-1">
          <h1 className="text-[21px] font-[650] -tracking-[0.02em] m-0">Discord</h1>
          <p className="text-[13px] text-[var(--color-muted)] mt-1 mb-0">
            Bridged to <strong>Agentic OS Crew</strong> · send messages and dispatch agents
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-[9px] py-2 rounded-full text-[11px] font-semibold" style={{ color: "#34d399", background: "color-mix(in srgb, #34d399 13%, transparent)" }}>
          <span className="size-1.5 rounded-full" style={{ background: "#34d399" }} />
          Connected
        </span>
      </div>

      <div className="panel p-4 text-center text-[var(--color-muted)] text-sm">
        <p>Discord integration interface would render here</p>
        <p className="text-xs mt-2 text-[var(--color-faint)]">Full Discord client implementation with channels, messages, and members</p>
      </div>
    </div>
  );
}
