import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getProvider } from "@/lib/providers";
import { AGENT_ORDER, AGENTS, isAgentId } from "@/lib/config/agents";
import type { AgentId } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, type TabDef } from "@/components/ui/tabs";
import { Icon } from "@/components/icon";
import { SessionList } from "@/components/agent/session-list";
import { ChatInput } from "@/components/agent/chat-input";
import { Terminal } from "@/components/agent/terminal";
import {
  ChangedFiles,
  ClaudeAside,
  CodexAside,
  DetailRow,
  HermesAside,
  NoteViewer,
  ObsidianAside,
  PlanList,
} from "@/components/agent/panels";
import type { AgentPageData } from "@/lib/providers/types";
import { readSessions } from "@/lib/claude-code/reader";
import type { Session } from "@/lib/types";

export function generateStaticParams() {
  return AGENT_ORDER.map((agent) => ({ agent }));
}

function accentStyle(hex: string): CSSProperties {
  return {
    ["--accent" as string]: hex,
    ["--accent-soft" as string]: `color-mix(in srgb, ${hex} 16%, transparent)`,
    ["--accent-line" as string]: `color-mix(in srgb, ${hex} 38%, transparent)`,
  };
}

function NewSessionButton() {
  return (
    <button
      className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      style={{ background: "var(--accent)" }}
    >
      <Icon name="Plus" size={15} /> New Session
    </button>
  );
}

function Placeholder({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-faint">
      <Icon name={icon} size={28} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function buildPanels(id: AgentId, data: AgentPageData): { tabs: TabDef[]; panels: Record<string, React.ReactNode>; defaultId: string } {
  const cfg = AGENTS[id];
  const s = data.activeSession;
  const term = <Terminal transcript={s.transcript} prompt={`${id}@${s.workspace ?? "agentic-os"}:~$`} />;
  const panels: Record<string, React.ReactNode> = { terminal: term };
  let defaultId = "terminal";

  if (id === "claude-code") {
    panels.files = s.filesTouched ? <ChangedFiles files={s.filesTouched} /> : <Placeholder icon="FileText" text="No files changed yet" />;
    panels.mcp = (
      <ul className="space-y-1.5 text-sm">
        {["filesystem", "github", "postgres", "playwright", "memory", "fetch", "sequential-thinking", "git"].map((m) => (
          <li key={m} className="flex items-center justify-between rounded-md border border-line px-3 py-2">
            <span className="flex items-center gap-2 font-mono text-muted">
              <Icon name="Plug" size={13} className="text-[var(--accent)]" /> {m}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ok">
              <span className="size-1.5 rounded-full bg-ok" /> connected
            </span>
          </li>
        ))}
      </ul>
    );
    panels.settings = (
      <div className="divide-y divide-line">
        <DetailRow label="Model">{s.model}</DetailRow>
        <DetailRow label="Mode">Interactive</DetailRow>
        <DetailRow label="Memory">Enabled</DetailRow>
        <DetailRow label="MCP Servers">8 connected</DetailRow>
      </div>
    );
  }

  if (id === "codex") {
    panels.plan = s.plan ? <PlanList plan={s.plan} /> : <Placeholder icon="ListChecks" text="No plan yet" />;
    panels.changes = s.filesTouched ? <ChangedFiles files={s.filesTouched} /> : <Placeholder icon="FileText" text="No changes" />;
    panels.tests = (
      <div className="space-y-1.5 font-mono text-[12.5px]">
        <div className="flex items-center gap-2 text-ok"><Icon name="CircleCheck" size={14} /> auth.test.ts — 18 passed</div>
        <div className="flex items-center gap-2 text-ok"><Icon name="CircleCheck" size={14} /> providers.test.ts — 14 passed</div>
        <div className="flex items-center gap-2 text-ok"><Icon name="CircleCheck" size={14} /> callbacks.test.ts — 10 passed</div>
        <div className="mt-2 text-muted">Test Suites: 3 passed, 3 total</div>
        <div className="text-ok">Tests: 42 passed, 42 total (100%)</div>
      </div>
    );
    panels.logs = term;
  }

  if (id === "hermes") {
    panels.memory = data.memory ? (
      <div className="space-y-3">
        {data.memory.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{m.label}</span>
              <span className="font-medium">{m.size}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${m.pct ?? 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    ) : null;
    panels.skills = (
      <ul className="divide-y divide-line text-sm">
        {(data.skills ?? []).map((sk) => (
          <li key={sk.name} className="flex items-center justify-between py-2">
            <span className="font-mono text-muted">{sk.name}</span>
            <span className={sk.status === "active" ? "text-ok" : "text-faint"}>{sk.status}</span>
          </li>
        ))}
      </ul>
    );
    panels.jobs = (
      <ul className="divide-y divide-line text-sm">
        {(data.jobs ?? []).map((j) => (
          <li key={j.name} className="flex items-center justify-between py-2">
            <span className="font-mono text-muted">{j.name}</span>
            <span className="font-mono text-xs text-faint">{j.schedule ?? "—"}</span>
          </li>
        ))}
      </ul>
    );
    panels.settings = (
      <div className="divide-y divide-line">
        <DetailRow label="Active profile">research</DetailRow>
        <DetailRow label="Model">{s.model}</DetailRow>
        <DetailRow label="Log level">info</DetailRow>
        <DetailRow label="Gateway">Telegram · Slack</DetailRow>
      </div>
    );
  }

  if (id === "obsidian") {
    defaultId = "notes";
    panels.notes = data.notes?.[0] ? <NoteViewer note={data.notes[0]} /> : <Placeholder icon="FileText" text="No note selected" />;
    panels.graph = <Placeholder icon="Network" text="Graph view — 1,284 notes · 9,612 links" />;
    panels.settings = (
      <div className="divide-y divide-line">
        <DetailRow label="Vault">Refuelr</DetailRow>
        <DetailRow label="Notes">1,284</DetailRow>
        <DetailRow label="Sync">Enabled</DetailRow>
      </div>
    );
  }

  // Codex "Changes" tab shows a count badge
  const tabs: TabDef[] = cfg.tabs.map((t) =>
    id === "codex" && t.id === "changes" ? { ...t, badge: s.filesTouched?.length } : t,
  );

  return { tabs, panels, defaultId };
}

function Aside({ id, data }: { id: AgentId; data: AgentPageData }) {
  switch (id) {
    case "claude-code":
      return <ClaudeAside s={data.activeSession} />;
    case "codex":
      return <CodexAside s={data.activeSession} />;
    case "hermes":
      return <HermesAside memory={data.memory} skills={data.skills} jobs={data.jobs} />;
    case "obsidian":
      return <ObsidianAside notes={data.notes} />;
  }
}

export default async function AgentPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  if (!isAgentId(agent)) notFound();

  const data = await getProvider().getAgentPage(agent);

  if (agent === "claude-code") {
    const real = readSessions(100);
    if (real.length > 0) {
      data.sessions = real.map((s): Session => ({
        id: s.id,
        agentId: "claude-code",
        title: s.title,
        workspace: s.workspace,
        status: s.status,
        updatedAt: s.updatedAt,
        group: s.group,
      }));
    }
  }
  const cfg = AGENTS[agent];
  const { tabs, panels, defaultId } = buildPanels(agent, data);
  const s = data.activeSession;

  return (
    <div style={accentStyle(cfg.accent)}>
      <PageHeader
        title={cfg.name}
        subtitle={cfg.tagline}
        icon={cfg.icon}
        accent={cfg.accent}
        right={
          <>
            <button className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-muted hover:text-ink">
              <Icon name="Maximize2" size={16} />
            </button>
            <NewSessionButton />
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      {/* Sessions · active session · details */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <SessionList sessions={data.sessions} activeId={s.id} />
        </div>

        <div className="xl:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  {s.title}
                  <span className="flex items-center gap-1 text-xs font-medium text-ok">
                    <span className="size-1.5 rounded-full bg-ok animate-pulse" /> Live
                  </span>
                </span>
              </CardTitle>
              <div className="flex items-center gap-1 text-faint">
                <button className="grid size-7 place-items-center rounded-md hover:bg-surface-2 hover:text-muted">
                  <Icon name="Maximize2" size={14} />
                </button>
                <button className="grid size-7 place-items-center rounded-md hover:bg-surface-2 hover:text-muted">
                  <Icon name="MoreVertical" size={14} />
                </button>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <Tabs tabs={tabs} panels={panels} defaultId={defaultId} />
              <div className="mt-4">
                <ChatInput agentId={agent} placeholder={`Message ${cfg.name}...`} model={s.model} />
                <p className="mt-1.5 text-center text-[11px] text-faint">Shift + Enter for new line, Enter to send</p>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="xl:col-span-3">
          <Aside id={agent} data={data} />
        </div>
      </div>
    </div>
  );
}
