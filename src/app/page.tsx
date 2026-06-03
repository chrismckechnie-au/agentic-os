export const dynamic = "force-dynamic";

import Link from "next/link";
import { getHermesCrewDashboard, getKanbanBoard } from "@/lib/providers";
import { Icon, type IconName } from "@/components/icon";
import { HERMES_CREW_ROLE_LABELS } from "@/lib/config/hermes-crew";
import { PRIORITY_META } from "@/lib/config/kanban";
import type { HermesCrewActivity, HermesCrewProfile, HermesCrewRole, KanbanTask, TaskStatus } from "@/lib/types";

// Hermes accent color (purple)
const HERMES_ACCENT = "#a855f7";

// Crew profile ids (refuelr-*) don't map to the AGENTS registry, so the crew
// roster and orchestration graph are driven by each profile's own role.
const ROLE_ACCENT: Record<HermesCrewRole, string> = {
  orchestrator: "#a855f7",
  engineering: "#60a5fa",
  incidents: "#f87171",
  social: "#f5b13d",
  research: "#2dd4bf",
};

const ROLE_ICON: Record<HermesCrewRole, string> = {
  orchestrator: "Workflow",
  engineering: "Cpu",
  incidents: "ShieldCheck",
  social: "SendHorizontal",
  research: "BookOpen",
};

const STATUS_DOT: Record<string, string> = {
  running: "#34d399",
  online: "#34d399",
  attention: "#f5b13d",
  missing: "#f87171",
  idle: "#5f6675",
};

function statusDot(status: string): string {
  return STATUS_DOT[status] ?? "#5f6675";
}

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function normalizeProfileId(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const MISSION_STATUS_META: Record<TaskStatus, { label: string; tone: string; dot: string }> = {
  triage: { label: "Triage", tone: "text-faint bg-surface-2 border-line", dot: "#6b7280" },
  todo: { label: "To Do", tone: "text-muted bg-surface-2 border-line", dot: "#9aa1ad" },
  scheduled: { label: "Scheduled", tone: "text-info bg-info/12 border-info/25", dot: "#60a5fa" },
  ready: { label: "Ready", tone: "text-[var(--accent-2)] bg-[var(--accent-soft)] border-[var(--accent-line)]", dot: "#a78bfa" },
  running: { label: "Running", tone: "text-ok bg-ok/12 border-ok/25", dot: "#34d399" },
  blocked: { label: "Blocked", tone: "text-warn bg-warn/12 border-warn/25", dot: "#f59e0b" },
  review: { label: "Review", tone: "text-[var(--accent-2)] bg-[var(--accent-soft)] border-[var(--accent-line)]", dot: "#c084fc" },
  done: { label: "Done", tone: "text-ok bg-ok/12 border-ok/25", dot: "#10b981" },
  archived: { label: "Archived", tone: "text-faint bg-surface-2 border-line", dot: "#5f6675" },
};

const ACTIVE_MISSION_ORDER: Record<TaskStatus, number> = {
  running: 0,
  blocked: 1,
  review: 2,
  ready: 3,
  scheduled: 4,
  todo: 5,
  triage: 6,
  done: 7,
  archived: 8,
};

function workerForTask(task: KanbanTask, crew: HermesCrewProfile[]): HermesCrewProfile | undefined {
  const normalized = normalizeProfileId(task.assignee);
  if (!normalized) return undefined;
  return crew.find((profile) => normalizeProfileId(profile.id) === normalized);
}

function missionSort(a: KanbanTask, b: KanbanTask): number {
  const byStatus = ACTIVE_MISSION_ORDER[a.status] - ACTIVE_MISSION_ORDER[b.status];
  if (byStatus !== 0) return byStatus;
  const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
  if (byPriority !== 0) return byPriority;
  return a.title.localeCompare(b.title);
}

const ACTIVITY_SOURCE_META: Record<HermesCrewActivity["source"], { label: string; icon: string; color: string }> = {
  kanban: { label: "Kanban", icon: "SquareKanban", color: "#a855f7" },
  cron: { label: "Cron", icon: "Calendar", color: "#60a5fa" },
  gateway: { label: "Gateway", icon: "Plug", color: "#34d399" },
  "mission-control": { label: "Mission Control", icon: "Workflow", color: "#f5b13d" },
};

function activityOwner(activity: HermesCrewActivity, crew: HermesCrewProfile[]): string | undefined {
  const normalized = normalizeProfileId(activity.profile);
  if (!normalized) return activity.role ? HERMES_CREW_ROLE_LABELS[activity.role] : undefined;
  const profile = crew.find((entry) => normalizeProfileId(entry.id) === normalized);
  return profile ? `${profile.name} · ${HERMES_CREW_ROLE_LABELS[profile.role]}` : activity.profile;
}

// Orchestration graph geometry (SVG user units; the <svg> scales to card width).
const HUB_X = 235;
const HUB_Y = 230;
const HUB_R = 82;
const NODE_X = 905;
const NODE_R = 40;
const LIST_TOP = 72;
const LIST_BOTTOM = 388;

// Smooth horizontal S-curve connector from the hub edge to a node edge.
function edgePath(sx: number, sy: number, ex: number, ey: number): string {
  const c1x = sx + (ex - sx) * 0.5;
  const c2x = ex - (ex - sx) * 0.5;
  return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ey}, ${ex} ${ey}`;
}

// 4-point sparkle (Hermes mark) centered at (cx, cy).
function sparklePoints(cx: number, cy: number, outer: number, inner: number): string {
  return [
    [cx, cy - outer],
    [cx + inner, cy - inner],
    [cx + outer, cy],
    [cx + inner, cy + inner],
    [cx, cy + outer],
    [cx - inner, cy + inner],
    [cx - outer, cy],
    [cx - inner, cy - inner],
  ]
    .map(([px, py]) => `${px},${py}`)
    .join(" ");
}

export default async function CommandCenterPage() {
  const [hermes, board] = await Promise.all([getHermesCrewDashboard(), getKanbanBoard()]);

  const activeMissions = board.tasks
    .filter((task) => ["running", "blocked", "review", "ready", "scheduled"].includes(task.status))
    .sort(missionSort)
    .slice(0, 4);

  const metrics = [
    { icon: "Cpu", label: "Agents", value: hermes.crew.length, hint: "in crew" },
    { icon: "Target", label: "Tasks", value: board.stats.active, hint: "on board" },
    { icon: "Zap", label: "Running", value: hermes.stats.runningTasks, hint: "this session" },
    { icon: "TrendingUp", label: "Uptime", value: "99.8%", hint: "system health" },
  ];

  // Left-hub layout: Hermes on the left, crew stacked on the right with curved
  // "dispatch flow" connectors.
  const crewCount = hermes.crew.length;
  const graphNodes = hermes.crew.map((c, i) => {
    const y =
      crewCount > 1
        ? LIST_TOP + (i * (LIST_BOTTOM - LIST_TOP)) / (crewCount - 1)
        : (LIST_TOP + LIST_BOTTOM) / 2;
    return {
      profile: c,
      y,
      accent: ROLE_ACCENT[c.role] ?? HERMES_ACCENT,
    };
  });

  return (
    <div className="mx-auto max-w-[1320px]">
      {/* ---- Hero Section ---- */}
      <section
        className="relative mb-4 overflow-hidden rounded-[14px] border p-[16px] md:p-[26px] backdrop-blur"
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
          <div className="flex items-start gap-[12px] md:gap-[18px] mb-[22px]">
            {/* Orb */}
            <div
              className="relative flex size-14 md:size-16 shrink-0 items-center justify-center rounded-[19px] border"
              style={{
                background: `linear-gradient(150deg, color-mix(in srgb, ${HERMES_ACCENT} 32%, transparent), color-mix(in srgb, ${HERMES_ACCENT} 10%, transparent))`,
                borderColor: `color-mix(in srgb, ${HERMES_ACCENT} 45%, transparent)`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 40px -10px color-mix(in srgb, ${HERMES_ACCENT} 70%, transparent)`,
              }}
            >
              <Icon name="HermesLogo" size={28} className="md:!w-[34px] md:!h-[34px]" color={HERMES_ACCENT} />
              <div
                className="absolute -inset-1.5 rounded-[24px] border pointer-events-none animate-pulse"
                style={{ borderColor: `color-mix(in srgb, ${HERMES_ACCENT} 30%, transparent)` }}
              />
            </div>

            {/* ID + Title */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-[7px] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#c084fc" }}>
                <span className="size-2 rounded-full" style={{ background: "#34d399" }} />
                <span className="hidden sm:inline">Command Center · Online</span>
                <span className="sm:hidden">Online</span>
              </div>
              <h1 className="text-[22px] md:text-[30px] font-[680] -tracking-[0.03em] leading-none mt-1 mb-1">Hermes</h1>
              <div className="text-[12px] md:text-[13px] text-[var(--color-ink-2)]">
                Autonomous orchestration — commanding {hermes.crew.length} agents with {hermes.stats.runningTasks} tasks running.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 md:gap-[9px] flex-shrink-0">
              <button className="hidden md:inline-flex items-center gap-2 px-[13px] py-2 rounded-[10px] text-[13px] font-[550] border border-[var(--color-line-2)] text-[var(--color-ink-2)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors">
                <Icon name="Radio" size={14} />
                <span>Crew</span>
              </button>
              <button
                className="inline-flex items-center gap-1 md:gap-2 px-[11px] md:px-[13px] py-2 rounded-[10px] text-[12px] md:text-[13px] font-[550] text-white transition-[filter,colors] hover:brightness-110"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <Icon name={m.icon as IconName} size={15} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{m.label}</span>
                </div>
                <div className="text-[26px] font-[660] -tracking-[0.025em] leading-none mt-[9px] mb-[6px]">{m.value}</div>
                <div className="text-[11.5px] text-[var(--color-faint)] min-h-[15px]">{m.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Orchestration (full width) ---- */}
      <div className="panel mb-4">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-[18px] py-3">
          <div className="flex items-center gap-2">
            <Icon name="Orbit" size={15} className="text-[var(--color-muted)]" />
            <h3 className="text-[14px] font-semibold">Orchestration</h3>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-[12px] font-semibold border"
            style={{ color: "#34d399", borderColor: "color-mix(in srgb, #34d399 35%, transparent)", background: "color-mix(in srgb, #34d399 12%, transparent)" }}
          >
            <span className="size-2 rounded-full animate-pulse" style={{ background: "#34d399" }} />
            Dispatching
          </span>
        </div>

        {graphNodes.length === 0 ? (
          <div className="p-6 text-center text-[var(--color-muted)] text-[12px]">
            No crew profiles detected — Hermes orchestration is idle.
          </div>
        ) : (
          <>
            <div className="px-3 md:px-4 py-2 overflow-x-auto">
              <svg viewBox="0 0 1180 460" className="w-full h-auto min-w-max md:min-w-0" role="img" aria-label="Hermes orchestration graph">
                <defs>
                  <radialGradient id="hub-grad" cx="50%" cy="36%" r="68%">
                    <stop offset="0%" stopColor="#c9a0ff" />
                    <stop offset="55%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#6d28d9" />
                  </radialGradient>
                  <radialGradient id="hub-aura" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
                    <stop offset="55%" stopColor="#a855f7" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                  </radialGradient>
                  <filter id="soft-glow" x="-70%" y="-70%" width="240%" height="240%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="hub-glow" x="-120%" y="-120%" width="340%" height="340%">
                    <feGaussianBlur stdDeviation="10" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Hub aura */}
                <circle cx={HUB_X} cy={HUB_Y} r={130} fill="url(#hub-aura)" />

                {/* Dispatch-flow edges (under hub + nodes) */}
                {graphNodes.map(({ profile, y, accent }) => (
                  <path
                    key={`edge-${profile.id}`}
                    className="dash-flow"
                    d={edgePath(HUB_X + HUB_R - 6, HUB_Y, NODE_X - NODE_R, y)}
                    fill="none"
                    stroke={accent}
                    strokeOpacity={0.9}
                    strokeWidth={3}
                    strokeDasharray="9 9"
                    strokeLinecap="round"
                  />
                ))}

                {/* Hermes hub */}
                <circle className="live-dot" cx={HUB_X} cy={HUB_Y} r={HUB_R + 22} fill="none" stroke="#a855f7" strokeOpacity={0.3} strokeWidth={1.5} />
                <circle cx={HUB_X} cy={HUB_Y} r={HUB_R + 12} fill="none" stroke="#a855f7" strokeOpacity={0.5} strokeWidth={1.5} />
                <circle cx={HUB_X} cy={HUB_Y} r={HUB_R} fill="url(#hub-grad)" stroke="#c9a0ff" strokeWidth={2.5} filter="url(#hub-glow)" />
                <polygon points={sparklePoints(HUB_X, HUB_Y - 8, 26, 9)} fill="#ffffff" />
                <text x={HUB_X} y={HUB_Y + 46} textAnchor="middle" fontSize={17} fontWeight={700} fill="#ffffff">Hermes</text>

                {/* Crew nodes */}
                {graphNodes.map(({ profile, y, accent }) => (
                  <g key={`node-${profile.id}`}>
                    <circle cx={NODE_X} cy={y} r={NODE_R} fill={accent} fillOpacity={0.12} stroke={accent} strokeWidth={2} filter="url(#soft-glow)" />
                    <foreignObject x={NODE_X - 19} y={y - 19} width={38} height={38}>
                      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                        <Icon name={ROLE_ICON[profile.role] ?? "Workflow"} size={21} color={accent} />
                      </div>
                    </foreignObject>
                    <circle cx={NODE_X + 28} cy={y - 28} r={6.5} fill={statusDot(profile.status)} stroke="#0a0c11" strokeWidth={2.5} />
                    <text x={NODE_X + NODE_R + 22} y={y - 4} fontSize={18} fontWeight={700} fill="#f1f2f6">{profile.name}</text>
                    <text x={NODE_X + NODE_R + 22} y={y + 20} fontSize={14} fill="#969cab">
                      {HERMES_CREW_ROLE_LABELS[profile.role]} · {titleCase(profile.status)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-[var(--color-line)] px-[18px] py-3 text-[12px] text-[var(--color-muted)]">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-0 w-7 border-t-2 border-dashed" style={{ borderColor: "#a855f7" }} />
                live dispatch flow
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: "#34d399" }} />
                working
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: "#f5b13d" }} />
                degraded
              </span>
            </div>
          </>
        )}
      </div>

      {/* ---- Main Grid: Missions + Crew/Dispatch ---- */}
      <div className="grid grid-cols-1 md:grid-cols-[1.55fr_1fr] gap-4 items-start">
        {/* Left: Missions */}
        <div className="space-y-4">
          {/* Missions */}
          <div className="panel">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-[18px] py-3">
              <div className="flex items-center gap-2">
                <Icon name="Target" size={15} className="text-[var(--color-muted)]" />
                <h3 className="text-[14px] font-semibold">Active missions</h3>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider"
                  style={{
                    color: board.source === "live" ? "#34d399" : board.source === "degraded" ? "#f5b13d" : "var(--color-faint)",
                    borderColor:
                      board.source === "live"
                        ? "color-mix(in srgb, #34d399 35%, transparent)"
                        : board.source === "degraded"
                          ? "color-mix(in srgb, #f5b13d 35%, transparent)"
                          : "var(--color-line)",
                    background:
                      board.source === "live"
                        ? "color-mix(in srgb, #34d399 12%, transparent)"
                        : board.source === "degraded"
                          ? "color-mix(in srgb, #f5b13d 12%, transparent)"
                          : "var(--color-surface-2)",
                  }}
                >
                  <span
                    className={`size-1.5 rounded-full ${board.source === "live" ? "animate-pulse" : ""}`}
                    style={{
                      background:
                        board.source === "live" ? "#34d399" : board.source === "degraded" ? "#f5b13d" : "#5f6675",
                    }}
                  />
                  {board.source}
                </span>
                <Link href="/kanban" className="inline-flex items-center gap-1 rounded-[7px] px-2 py-1 text-[12px] text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--accent-2)]">
                  Board
                  <Icon name="ArrowRight" size={13} />
                </Link>
              </div>
            </div>
            <div className="divide-y divide-[var(--color-line)]">
              {activeMissions.length === 0 && (
                <div className="p-[18px] text-center text-[12px] text-[var(--color-muted)]">
                  No running or queued kanban missions on the active board.
                </div>
              )}
              {activeMissions.map((task) => {
                const worker = workerForTask(task, hermes.crew);
                const statusMeta = MISSION_STATUS_META[task.status];
                const priorityMeta = PRIORITY_META[task.priority];
                return (
                  <div key={task.id} className="p-[14px_18px]">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] border"
                        style={{
                          color: statusMeta.dot,
                          background: `color-mix(in srgb, ${statusMeta.dot} 14%, transparent)`,
                          borderColor: `color-mix(in srgb, ${statusMeta.dot} 30%, transparent)`,
                        }}
                      >
                        <Icon name={task.status === "running" ? "Play" : task.status === "blocked" ? "CircleDot" : "SquareKanban"} size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[13.5px] font-semibold text-[var(--color-ink)]">{task.title}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-semibold ${statusMeta.tone}`}>
                            <span className="size-1.5 rounded-full" style={{ background: statusMeta.dot }} />
                            {statusMeta.label}
                          </span>
                          {priorityMeta && (
                            <span className={`rounded-full border px-2 py-1 text-[10.5px] font-semibold ${priorityMeta.className}`}>
                              {priorityMeta.label}
                            </span>
                          )}
                        </div>

                        {task.body && <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[var(--color-muted)]">{task.body}</p>}

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-faint)]">
                          <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 font-mono">
                            {task.id}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1">
                            <span
                              className="size-1.5 rounded-full"
                              style={{ background: statusDot(worker?.status ?? "idle") }}
                            />
                            {worker ? `${worker.name} · ${HERMES_CREW_ROLE_LABELS[worker.role]}` : task.assignee ?? "Unassigned"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1">
                            <Icon name="Clock" size={12} />
                            {task.runtime ?? task.startedAt ?? task.createdAt}
                          </span>
                          {typeof task.deps === "number" && task.deps > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1">
                              <Icon name="Link2" size={12} />
                              {task.deps} deps
                            </span>
                          )}
                          {task.branchName && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1">
                              <Icon name="GitBranch" size={12} />
                              {task.branchName}
                            </span>
                          )}
                        </div>

                        {task.skills && task.skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {task.skills.slice(0, 4).map((skill) => (
                              <span
                                key={skill}
                                className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)]"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
              {hermes.crew.length === 0 && (
                <div className="p-[18px] text-center text-[12px] text-[var(--color-muted)]">No crew profiles available.</div>
              )}
              {hermes.crew.slice(0, 5).map((c) => {
                const accent = ROLE_ACCENT[c.role] ?? HERMES_ACCENT;
                return (
                  <Link key={c.id} href="/agents/hermes" className="flex items-center gap-3 p-[13px_18px] hover:bg-[var(--color-surface-hover)] transition-colors">
                    <div
                      className="size-[38px] rounded-[9px] flex items-center justify-center shrink-0"
                      style={{
                        color: accent,
                        background: `color-mix(in srgb, ${accent} 18%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
                      }}
                    >
                      <Icon name={ROLE_ICON[c.role] ?? "Workflow"} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{c.name}</div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-faint)] mt-[2px]">{HERMES_CREW_ROLE_LABELS[c.role]}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold" style={{ color: accent, background: `color-mix(in srgb, ${accent} 13%, transparent)` }}>
                        <span className="size-1.5 rounded-full" style={{ background: statusDot(c.status) }} />
                        {c.status}
                      </span>
                      <span className="text-[10.5px] text-[var(--color-faint)]">{c.openTasks} open · {c.runningTasks} running</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Dispatch Log */}
          <div className="panel">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-[18px] py-3">
              <div className="flex items-center gap-2">
                <Icon name="ArrowRightLeft" size={15} className="text-[var(--color-muted)]" />
                <h3 className="text-[14px] font-semibold">Dispatch flow</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px_9px] text-[11px] font-semibold" style={{ color: "#34d399", background: "color-mix(in srgb, #34d399 13%, transparent)" }}>
                <span className="size-1.5 rounded-full animate-pulse" style={{ background: "#34d399" }} />
                Live
              </span>
            </div>
            <div className="divide-y divide-[color-mix(in_srgb,var(--color-line)_60%,transparent)]">
              {hermes.activity.length === 0 && (
                <div className="p-[18px] text-center text-[12px] text-[var(--color-muted)]">
                  No active Hermes events are flowing through the dashboard right now.
                </div>
              )}
              {hermes.activity.slice(0, 6).map((activity) => {
                const sourceMeta = ACTIVITY_SOURCE_META[activity.source];
                const owner = activityOwner(activity, hermes.crew);
                return (
                  <div key={activity.id} className="px-[18px] py-[12px]">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] border"
                        style={{
                          color: sourceMeta.color,
                          background: `color-mix(in srgb, ${sourceMeta.color} 14%, transparent)`,
                          borderColor: `color-mix(in srgb, ${sourceMeta.color} 30%, transparent)`,
                        }}
                      >
                        <Icon name={sourceMeta.icon} size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-[12.5px] font-semibold text-[var(--color-ink-2)]">
                            {activity.title || "Task dispatched"}
                          </div>
                          <span className="flex-none whitespace-nowrap text-[10.5px] text-[var(--color-faint)]">
                            {activity.when || "—"}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px]">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-semibold"
                            style={{
                              color: sourceMeta.color,
                              borderColor: `color-mix(in srgb, ${sourceMeta.color} 30%, transparent)`,
                              background: `color-mix(in srgb, ${sourceMeta.color} 12%, transparent)`,
                            }}
                          >
                            <span className="size-1.5 rounded-full" style={{ background: sourceMeta.color }} />
                            {sourceMeta.label}
                          </span>
                          {activity.status && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 font-semibold text-[var(--color-muted)]">
                              <span className="size-1.5 rounded-full" style={{ background: statusDot(activity.status) }} />
                              {titleCase(activity.status)}
                            </span>
                          )}
                          {owner && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-1 text-[var(--color-faint)]">
                              <Icon name="User" size={11} />
                              {owner}
                            </span>
                          )}
                        </div>

                        {activity.summary && (
                          <p className="mt-2 line-clamp-2 text-[11.5px] leading-5 text-[var(--color-muted)]">
                            {activity.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
