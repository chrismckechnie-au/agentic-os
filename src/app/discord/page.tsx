export const dynamic = "force-dynamic";

import { Icon } from "@/components/icon";
import { AGENTS } from "@/lib/config/agents";

// Mock Discord data
const MOCK_DISCORD_DATA = {
  server: { name: "Agentic OS Crew" },
  categories: [
    {
      name: "General",
      channels: [
        { id: "general", name: "general", unread: 0, bot: false },
        { id: "announcements", name: "announcements", unread: 2, bot: false },
      ],
    },
    {
      name: "Operations",
      channels: [
        { id: "agent-ops", name: "agent-ops", unread: 5, bot: false },
        { id: "deployments", name: "deployments", unread: 0, bot: true },
      ],
    },
    {
      name: "Voice",
      channels: [
        { id: "sync-calls", name: "sync-calls", voice: true, inCall: "2" },
      ],
    },
  ],
  messages: {
    "agent-ops": [
      { author: "you", text: "need to run the **research** task", time: "2:45 PM", bot: false },
      { author: "hermes", text: "@Architect will handle the research phase", time: "2:46 PM", bot: true },
      { author: "architect", text: "Starting research on the codebase...", time: "2:47 PM", bot: false, embed: { kind: "session", title: "Research session", repo: "agentic-os", branch: "main" } },
    ],
  },
  members: [
    { id: "you", name: "Chris M.", role: "Admin", status: "online", bot: false },
    { id: "hermes", name: "Hermes", role: "Orchestrator", status: "online", bot: true },
    { id: "architect", name: "Architect", role: "Research", status: "online", bot: true },
    { id: "executor", name: "Executor", role: "Implementation", status: "idle", bot: true },
  ],
};

const DISCORD_COLOR = "#5865F2";

export default async function DiscordPage() {
  const activeChannel = "agent-ops";
  const currentChannel = MOCK_DISCORD_DATA.categories
    .flatMap((cat) => cat.channels)
    .find((ch) => ch.id === activeChannel) || MOCK_DISCORD_DATA.categories[0].channels[0];
  const messages = MOCK_DISCORD_DATA.messages[activeChannel as keyof typeof MOCK_DISCORD_DATA.messages] || [];

  function authorColor(id: string) {
    if (id === "you") return "#3ba55d";
    if (id === "hermes") return DISCORD_COLOR;
    return AGENTS[id as keyof typeof AGENTS]?.accent || "#5865F2";
  }

  function authorName(id: string) {
    if (id === "you") return "Chris M.";
    if (id === "hermes") return "Hermes";
    return AGENTS[id as keyof typeof AGENTS]?.name || id;
  }

  function authorAvatar(id: string, size: number = 38) {
    const c = authorColor(id);
    let inner: string;
    if (id === "you") {
      inner = `<span style="font-weight:650;font-size:${Math.round(size * 0.4)}px;color:#fff">CM</span>`;
    } else if (id === "hermes") {
      inner = `<svg viewBox="0 0 24 24" style="width:${Math.round(size * 0.5)}px;height:${Math.round(size * 0.5)}px" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>`;
    } else if (AGENTS[id as keyof typeof AGENTS]) {
      const agent = AGENTS[id as keyof typeof AGENTS];
      inner = `<span style="font-weight:650;font-size:${Math.round(size * 0.4)}px;color:#fff">${agent.name[0]}</span>`;
    } else {
      inner = `<span style="font-weight:650;font-size:${Math.round(size * 0.4)}px;color:#fff">B</span>`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:999px;display:grid;place-items:center;color:#fff;background:color-mix(in srgb, ${c} 92%, black 8%);box-shadow:inset 0 1px 0 rgba(255,255,255,.18);flex:none">${inner}</div>`;
  }

  const onlineMembers = MOCK_DISCORD_DATA.members.filter((m) => m.status !== "offline");
  const bots = onlineMembers.filter((m) => m.bot);
  const humans = onlineMembers.filter((m) => !m.bot);

  return (
    <div className="mx-auto max-w-[1320px]">
      {/* Page Header */}
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
            Bridged to <strong className="text-[var(--color-ink)]">{MOCK_DISCORD_DATA.server.name}</strong> · send messages and dispatch agents from any channel.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="inline-flex items-center gap-1.5 px-[9px] py-[3px_9px] rounded-full text-[11px] font-semibold" style={{ color: "#34d399", background: "color-mix(in srgb, #34d399 13%, transparent)" }}>
            <span className="size-1.5 rounded-full" style={{ background: "#34d399" }} />
            Connected
          </span>
          <button className="inline-flex items-center gap-2 px-[13px] py-2 rounded-[10px] text-[13px] font-[550] border border-[var(--color-line-2)] text-[var(--color-ink-2)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors">
            <Icon name="Settings" size={14} />
            <span>Configure</span>
          </button>
        </div>
      </div>

      {/* Discord Client */}
      <div
        className="panel p-0 overflow-hidden flex"
        style={{ height: "calc(100vh - 300px)", minHeight: "520px" }}
      >
        {/* Channel Rail */}
        <div
          className="w-[232px] border-r border-[var(--color-line)] flex flex-col flex-none overflow-hidden"
          style={{
            background: `color-mix(in srgb, var(--color-canvas-2) 80%, #0b0b14)`,
          }}
        >
          {/* Server Header */}
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[var(--color-line)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
            <span className="text-[14px] font-[650] -tracking-[0.01em] flex-1 min-w-0">{MOCK_DISCORD_DATA.server.name}</span>
            <Icon name="ChevronDown" size={16} className="text-[var(--color-muted)] flex-none" />
          </div>

          {/* Channel List */}
          <div className="flex-1 overflow-y-auto px-2 py-2.5">
            {MOCK_DISCORD_DATA.categories.map((cat) => (
              <div key={cat.name}>
                <div className="px-2 py-3 pt-3 pb-1">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-faint)]">{cat.name}</span>
                </div>
                <div className="space-y-1">
                  {cat.channels.map((ch) => (
                    <button
                      key={ch.id}
                      className={`w-full flex items-center gap-2 px-2 py-1.75 rounded-[7px] text-[13.5px] font-medium transition-colors ${
                        activeChannel === ch.id
                          ? "bg-[var(--color-surface-3)] text-[var(--color-ink)]"
                          : ch.unread
                            ? "text-[var(--color-ink)] font-semibold"
                            : "text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink-2)]"
                      }`}
                    >
                      <Icon name={ch.voice ? "Volume2" : "Hash"} size={16} className={activeChannel === ch.id ? "text-[var(--color-muted)]" : ch.unread ? "text-[var(--color-ink-2)]" : ""} />
                      <span className="min-w-0 flex-1 text-left truncate">{ch.name}</span>
                      {ch.inCall && <span className="text-[10.5px] text-[var(--color-ok)] font-semibold flex-none">{ch.inCall}</span>}
                      {ch.unread && !ch.voice && (
                        <span className="text-[10.5px] font-bold rounded-full px-1.5 min-w-[17px] text-center text-white bg-[var(--color-accent)] flex-none">{ch.unread}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: `color-mix(in srgb, var(--color-canvas) 60%, transparent)` }}>
          {/* Topbar */}
          <div className="flex items-center gap-2.25 px-4 h-[50px] border-b border-[var(--color-line)] flex-none">
            <Icon
              name={currentChannel.voice ? "Volume2" : "Hash"}
              size={18}
              className="text-[var(--color-muted)] flex-none"
            />
            <span className="text-[15px] font-[650]">{currentChannel.name}</span>
            <span className="w-px h-[18px] bg-[var(--color-line-2)] mx-1" />
            <span className="text-[12.5px] text-[var(--color-muted)] flex-1 truncate">#agent-ops — command the crew</span>
            <div className="flex gap-1 ml-auto">
              <button className="size-[32px] rounded-[8px] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] transition-colors">
                <Icon name="Pin" size={16} />
              </button>
              <button className="size-[32px] rounded-[8px] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] transition-colors">
                <Icon name="Users" size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <div key={idx} className="flex gap-3.5">
                <div dangerouslySetInnerHTML={{ __html: authorAvatar(msg.author, 40) }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[14px] font-semibold" style={{ color: authorColor(msg.author) }}>
                      {authorName(msg.author)}
                    </span>
                    {msg.bot && (
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-white rounded px-[5px] py-0.5 bg-[var(--color-accent)] transform -translate-y-0.5">
                        APP
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--color-faint)]">{msg.time}</span>
                  </div>
                  <div className="text-[14px] leading-6 text-[var(--color-ink-2)] break-words">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2.75 m-1 px-3 py-2.25 rounded-[11px] bg-[var(--color-surface-3)] border border-[var(--color-line)] flex-none transition-colors focus-within:border-[var(--accent-line)]">
            <button className="size-[26px] rounded-full flex items-center justify-center bg-[var(--color-muted)] text-[var(--color-canvas)] hover:bg-[var(--color-ink-2)] transition-colors flex-none">
              <Icon name="Plus" size={18} />
            </button>
            <input
              type="text"
              placeholder={`Message #${currentChannel.name}`}
              className="flex-1 min-w-0 bg-none border-none outline-none text-[var(--color-ink)] placeholder:text-[var(--color-faint)] text-[14px]"
            />
            <div className="flex items-center gap-1">
              <button className="size-[30px] rounded-[8px] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] transition-colors">
                <Icon name="AtSign" size={18} />
              </button>
              <button className="size-[30px] rounded-[8px] flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)] transition-colors">
                <Icon name="Smile" size={18} />
              </button>
              <button
                className="size-[32px] rounded-[9px] flex items-center justify-center text-white flex-none transition-colors hover:brightness-110"
                style={{
                  background: `linear-gradient(150deg, var(--color-accent), var(--color-accent-2))`,
                  boxShadow: `0 6px 16px -8px var(--color-accent)`,
                }}
              >
                <Icon name="Send" size={16} />
              </button>
            </div>
          </div>

          {/* Hint */}
          <div className="text-[11.5px] text-[var(--color-faint)] px-4 py-3">
            Tip: mention <span className="text-[var(--color-accent)] font-medium">@Hermes</span> to dispatch a task, or post in <strong className="text-[var(--color-ink-2)]">#agent-ops</strong> to command the crew.
          </div>
        </div>

        {/* Members */}
        <div
          className="w-[232px] border-l border-[var(--color-line)] overflow-y-auto px-2 py-3 flex-none"
          style={{
            background: `color-mix(in srgb, var(--color-canvas-2) 70%, transparent)`,
          }}
        >
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-faint)] px-2.5 py-3">
            Bots — {bots.length}
          </div>
          {bots.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] hover:bg-[var(--color-surface-hover)] transition-colors">
              <div className="relative flex-none">
                <div
                  dangerouslySetInnerHTML={{ __html: authorAvatar(m.id, 30) }}
                />
                <div
                  className="absolute -right-0.5 -bottom-0.5 size-[11px] rounded-full border-2"
                  style={{
                    background: m.status === "online" ? "var(--color-ok)" : m.status === "idle" ? "var(--color-warn)" : "var(--color-faint)",
                    borderColor: "var(--color-canvas-2)",
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--color-ink-2)]" style={{ color: authorColor(m.id) }}>
                  {m.name}
                </div>
                <div className="text-[10.5px] text-[var(--color-faint)]">{m.role}</div>
              </div>
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-white rounded px-1.5 py-0.5 bg-[var(--color-accent)] opacity-80 flex-none">
                APP
              </span>
            </div>
          ))}

          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-faint)] px-2.5 py-3 mt-3">
            Online — {humans.length}
          </div>
          {humans.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] hover:bg-[var(--color-surface-hover)] transition-colors">
              <div className="relative flex-none">
                <div
                  dangerouslySetInnerHTML={{ __html: authorAvatar(m.id, 30) }}
                />
                <div
                  className="absolute -right-0.5 -bottom-0.5 size-[11px] rounded-full border-2"
                  style={{
                    background: m.status === "online" ? "var(--color-ok)" : m.status === "idle" ? "var(--color-warn)" : "var(--color-faint)",
                    borderColor: "var(--color-canvas-2)",
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--color-ink-2)]">{m.name}</div>
                <div className="text-[10.5px] text-[var(--color-faint)]">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
