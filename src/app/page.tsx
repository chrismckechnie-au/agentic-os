export const dynamic = "force-dynamic";

import { getHermesCrewDashboard } from "@/lib/providers";
import { Icon } from "@/components/icon";
import { AGENTS } from "@/lib/config/agents";

export default async function CommandCenterPage() {
  const hermes = await getHermesCrewDashboard();

  // Hermes accent color (purple)
  const HERMES_ACCENT = "#a855f7";

  const metrics = [
    { icon: "Cpu", label: "Agents", value: hermes.crew.length, hint: "in crew" },
    { icon: "Target", label: "Tasks", value: hermes.jobs.length, hint: "active" },
    { icon: "Zap", label: "Running", value: hermes.stats.runningTasks, hint: "this session" },
    { icon: "TrendingUp", label: "Uptime", value: "99.8%", hint: "system health" },
  ];

  return (
    <div className="mx-auto max-w-[1320px]">
      {/* ---- Hero Section ---- */}
      <section
        className="relative mb-4 overflow-hidden rounded-[14px] border p-[26px] backdrop-blur"
        style={{
          background: `
            radial-gradient(520px 260px at 88% -30%, color-mix(in srgb, ${HERMES_ACCENT} 30%, transparent), transparent 70%),
            radial-gradient(420px 300px at 6% 130%, color-mix(in srgb, ${HERMES_ACCENT} 16%, transparent), transparent 65%),
            linear-gradient(140deg, rgba(168,85,247,0.1), rgba(17,19,25,0.7) 55%)
          `,
          borderColor: `color-mix(in srgb, ${HERMES_ACCENT} 30%, var(--color-line))`,
          boxShadow: `var(--shadow-panel), 0 0 60px -30px color-mix(in srgb, ${HERMES_ACCENT} 60%, transparent)`,
        }}
      >
        {/* Grain effect overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(120deg, #000, transparent 60%)",
          }}
        />

        <div className="relative">
          {/* Hero Top */}
          <div className="flex items-start gap-[18px] mb-[22px]">
            {/* Orb */}
            <div
              className="relative flex size-16 shrink-0 items-center justify-center rounded-[19px] border"
              style={{
                background: `linear-gradient(150deg, color-mix(in srgb, ${HERMES_ACCENT} 32%, transparent), color-mix(in srgb, ${HERMES_ACCENT} 10%, transparent))`,
                borderColor: `color-mix(in srgb, ${HERMES_ACCENT} 45%, transparent)`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 40px -10px color-mix(in srgb, ${HERMES_ACCENT} 70%, transparent)`,
              }}
            >
              <Icon name="HermesLogo" size={34} color={HERMES_ACCENT} />
              <div
                className="absolute -inset-1.5 rounded-[24px] border pointer-events-none animate-pulse"
                style={{ borderColor: `color-mix(in srgb, ${HERMES_ACCENT} 30%, transparent)` }}
              />
            </div>

            {/* ID + Title */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-[7px] text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#c084fc" }}>
                <span className="size-2 rounded-full" style={{ background: "#34d399" }} />
                Command Center · Online
              </div>
              <h1 className="text-[30px] font-[680] -tracking-[0.03em] leading-none mt-1 mb-1">Hermes</h1>
              <div className="text-[13px] text-[var(--color-ink-2)]">
                Autonomous orchestration — commanding {hermes.crew.length} agents with {hermes.stats.runningTasks} tasks running.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-[9px]">
              <button className="inline-flex items-center gap-2 px-[13px] py-2 rounded-[10px] text-[13px] font-[550] border border-[var(--color-line-2)] text-[var(--color-ink-2)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors">
                <Icon name="Radio" size={14} />
                <span>Crew</span>
              </button>
              <button
                className="inline-flex items-center gap-2 px-[13px] py-2 rounded-[10px] text-[13px] font-[550] text-white transition-[filter,colors] hover:brightness-110"
                style={{
                  background: `linear-gradient(150deg, ${HERMES_ACCENT}, #c084fc)`,
                  boxShadow: `0 10px 26px -12px ${HERMES_ACCENT}, inset 0 1px 0 rgba(255,255,255,0.3)`,
                }}
              >
                <Icon name="Workflow" size={14} />
                <span>Dispatch task</span>
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-[11px] border p-[13px_15px] backdrop-blur"
                style={{
                  background: "rgba(10,11,15,0.5)",
                  borderColor: "var(--color-line)",
                }}
              >
                <div className="flex items-center gap-2 text-[var(--color-muted)]" style={{ color: HERMES_ACCENT }}>
                  <Icon name={m.icon as any} size={15} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{m.label}</span>
                </div>
                <div className="text-[26px] font-[660] -tracking-[0.025em] leading-none mt-[9px] mb-[6px]">{m.value}</div>
                <div className="text-[11.5px] text-[var(--color-faint)] min-h-[15px]">{m.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Main Grid: Orchestration + Crew/Dispatch ---- */}
      <div className="grid grid-cols-[1.55fr_1fr] gap-4 items-start">
        {/* Left: Orchestration + Missions */}
        <div className="space-y-4">
          {/* Orchestration */}
          <div className="panel">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-[18px] py-3">
              <div className="flex items-center gap-2">
                <Icon name="Orbit" size={15} className="text-[var(--color-muted)]" />
                <h3 className="text-[14px] font-semibold">Orchestration</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-[9px] py-[3px_9px] rounded-full text-[11px] font-semibold" style={{ color: "#34d399", background: "color-mix(in srgb, #34d399 13%, transparent)" }}>
                <span className="size-1.5 rounded-full animate-pulse" style={{ background: "#34d399" }} />
                Dispatching
              </span>
            </div>
            <div className="p-4 text-center text-[var(--color-muted)] text-[12px]">
              <p>Orchestration graph visualization would render here</p>
              <p className="text-[10px] mt-2 text-[var(--color-faint)]">(Requires SVG rendering from Hermes data)</p>
            </div>
          </div>

          {/* Missions */}
          <div className="panel">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-[18px] py-3">
              <div className="flex items-center gap-2">
                <Icon name="Target" size={15} className="text-[var(--color-muted)]" />
                <h3 className="text-[14px] font-semibold">Active missions</h3>
              </div>
              <a href="/kanban" className="inline-flex items-center gap-1 px-2 py-1 text-[12px] text-[var(--color-muted)] rounded-[7px] hover:bg-[var(--color-surface-hover)] hover:text-[var(--accent-2)]">
                Board
                <Icon name="ArrowRight" size={13} />
              </a>
            </div>
            <div className="divide-y divide-[var(--color-line)]">
              {hermes.jobs.slice(0, 3).map((j, idx) => (
                <div key={idx} className="p-[14px_18px]">
                  <div className="flex items-center gap-2 mb-[10px]">
                    <Icon name="Target" size={15} color="#c084fc" />
                    <span className="text-[13.5px] font-semibold flex-1">{j.name}</span>
                    <span className="text-[12px] font-semibold text-[var(--color-ink-2)]">Active</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-[var(--color-surface-3)] overflow-hidden mb-3">
                    <div className="h-full rounded-full" style={{ width: "65%", background: `linear-gradient(90deg, var(--accent), var(--accent-2))` }} />
                  </div>
                  <div className="space-y-[2px] text-[12px]">
                    <div className="flex items-center gap-2 py-[5px]">
                      <div className="size-[18px] rounded-full border border-[var(--color-line-strong)] flex items-center justify-center text-[11px]" style={{ background: "#34d399", borderColor: "#34d399", color: "#04130c" }}>
                        <Icon name="Check" size={11} />
                      </div>
                      <span className="text-[var(--color-ink-2)]">{j.schedule || "manual"}</span>
                      <span className="text-[10.5px] text-[var(--color-faint)] ml-auto">running</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Crew + Dispatch Log */}
        <div className="space-y-4">
          {/* Crew */}
          <div className="panel">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-[18px] py-3">
              <div className="flex items-center gap-2">
                <Icon name="Cpu" size={15} className="text-[var(--color-muted)]" />
                <h3 className="text-[14px] font-semibold">Crew</h3>
              </div>
              <span className="text-[10px] font-semibold uppercase text-[var(--color-faint)] tracking-wider">{hermes.crew.length} commanded</span>
            </div>
            <div className="divide-y divide-[var(--color-line)]">
              {hermes.crew.slice(0, 4).map((c) => {
                const agent = AGENTS[c.id as keyof typeof AGENTS];
                if (!agent) return null;
                return (
                  <a key={c.id} href={`/agents/${c.id}`} className="flex items-center gap-3 p-[13px_18px] hover:bg-[var(--color-surface-hover)] transition-colors" style={{ "--aa": agent.accent } as any}>
                    <div className="size-[38px] rounded-[9px] flex items-center justify-center text-[12px] font-semibold shrink-0" style={{ background: agent.accent, color: "white" }}>
                      {agent.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--color-ink)]">{agent.name}</div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-faint)] mt-[2px]">{c.role}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold" style={{ color: agent.accent, background: `color-mix(in srgb, ${agent.accent} 13%, transparent)` }}>
                        <span className="size-1.5 rounded-full animate-pulse" style={{ background: agent.accent }} />
                        {c.status}
                      </span>
                      <span className="text-[10.5px] text-[var(--color-faint)]">dispatched {Math.floor(Math.random() * 20) + 1}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Dispatch Log */}
          <div className="panel">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-[18px] py-3">
              <div className="flex items-center gap-2">
                <Icon name="ArrowRightLeft" size={15} className="text-[var(--color-muted)]" />
                <h3 className="text-[14px] font-semibold">Dispatch log</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-[9px] py-[3px_9px] rounded-full text-[11px] font-semibold" style={{ color: "#34d399", background: "color-mix(in srgb, #34d399 13%, transparent)" }}>
                <span className="size-1.5 rounded-full animate-pulse" style={{ background: "#34d399" }} />
                Live
              </span>
            </div>
            <div className="divide-y divide-[color-mix(in_srgb,var(--color-line)_60%,transparent)]">
              {hermes.activity.slice(0, 6).map((a, idx) => (
                <div key={idx} className="flex items-center gap-2.5 px-[18px] py-[9px] text-[12px]">
                  <span className="flex items-center gap-2" style={{ color: "#a855f7" }}>
                    <Icon name="Send" size={13} />
                  </span>
                  <span className="text-[var(--color-ink-2)] flex-1 truncate">{a.title || "Task dispatched"}</span>
                  <span className="text-[10px] text-[var(--color-faint)] flex-none whitespace-nowrap">now</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
