"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, type TabDef } from "@/components/ui/tabs";
import { Icon } from "@/components/icon";
import { SessionList } from "@/components/agent/session-list";
import { ChatInput } from "@/components/agent/chat-input";
import { Terminal } from "@/components/agent/terminal";
import { PtyTerminal } from "@/components/agent/pty-terminal";
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
import type {
  AgentId,
  Job,
  MemoryStore,
  Note,
  Session,
  SessionDetail,
  Skill,
} from "@/lib/types";
import type { AgentConfig } from "@/lib/config/agents";

function Placeholder({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-faint">
      <Icon name={icon} size={28} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function buildPanels(
  agentId: AgentId,
  cfg: AgentConfig,
  detail: SessionDetail,
  terminalNode: React.ReactNode,
  extras: {
    memory?: MemoryStore[];
    skills?: Skill[];
    jobs?: Job[];
    notes?: Note[];
    note?: Note;
    vaultStats?: { notes: number; links: number; vaultName: string };
  },
): { tabs: TabDef[]; panels: Record<string, React.ReactNode>; defaultId: string } {
  const panels: Record<string, React.ReactNode> = { terminal: terminalNode };
  let defaultId = "terminal";

  if (agentId === "claude-code") {
    panels.files = detail.filesTouched ? (
      <ChangedFiles files={detail.filesTouched} />
    ) : (
      <Placeholder icon="FileText" text="No files changed yet" />
    );
    panels.mcp = (
      <ul className="space-y-1.5 text-sm">
        {["filesystem", "github", "postgres", "playwright", "memory", "fetch", "sequential-thinking", "git"].map(
          (m) => (
            <li key={m} className="flex items-center justify-between rounded-md border border-line px-3 py-2">
              <span className="flex items-center gap-2 font-mono text-muted">
                <Icon name="Plug" size={13} className="text-[var(--accent)]" /> {m}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-ok">
                <span className="size-1.5 rounded-full bg-ok" /> connected
              </span>
            </li>
          ),
        )}
      </ul>
    );
    panels.settings = (
      <div className="divide-y divide-line">
        <DetailRow label="Model">{detail.model ?? "—"}</DetailRow>
        <DetailRow label="Mode">Interactive</DetailRow>
        <DetailRow label="Memory">Enabled</DetailRow>
        <DetailRow label="MCP Servers">8 connected</DetailRow>
      </div>
    );
  }

  if (agentId === "codex") {
    panels.plan = detail.plan ? (
      <PlanList plan={detail.plan} />
    ) : (
      <Placeholder icon="ListChecks" text="No plan yet" />
    );
    panels.changes = detail.filesTouched ? (
      <ChangedFiles files={detail.filesTouched} />
    ) : (
      <Placeholder icon="FileText" text="No changes" />
    );
    panels.tests = (
      <div className="space-y-1.5 font-mono text-[12.5px]">
        <div className="flex items-center gap-2 text-ok">
          <Icon name="CircleCheck" size={14} /> auth.test.ts — 18 passed
        </div>
        <div className="flex items-center gap-2 text-ok">
          <Icon name="CircleCheck" size={14} /> providers.test.ts — 14 passed
        </div>
        <div className="flex items-center gap-2 text-ok">
          <Icon name="CircleCheck" size={14} /> callbacks.test.ts — 10 passed
        </div>
        <div className="mt-2 text-muted">Test Suites: 3 passed, 3 total</div>
        <div className="text-ok">Tests: 42 passed, 42 total (100%)</div>
      </div>
    );
    panels.logs = terminalNode;
  }

  if (agentId === "hermes") {
    panels.memory = extras.memory ? (
      <div className="space-y-3">
        {extras.memory.map((m) => (
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
        {(extras.skills ?? []).map((sk) => (
          <li key={sk.name} className="flex items-center justify-between py-2">
            <span className="font-mono text-muted">{sk.name}</span>
            <span className={sk.status === "active" ? "text-ok" : "text-faint"}>{sk.status}</span>
          </li>
        ))}
      </ul>
    );
    panels.jobs = (
      <ul className="divide-y divide-line text-sm">
        {(extras.jobs ?? []).map((j) => (
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
        <DetailRow label="Model">{detail.model ?? "—"}</DetailRow>
        <DetailRow label="Log level">info</DetailRow>
        <DetailRow label="Gateway">Telegram · Slack</DetailRow>
      </div>
    );
  }

  if (agentId === "obsidian") {
    defaultId = "notes";
    const note = extras.note ?? extras.notes?.[0];
    const vs = extras.vaultStats;
    panels.notes = note ? (
      <NoteViewer note={note} />
    ) : (
      <Placeholder icon="FileText" text="No note selected" />
    );
    panels.graph = (
      <Placeholder
        icon="Network"
        text={
          vs
            ? `Graph view — ${vs.notes.toLocaleString()} notes · ${vs.links.toLocaleString()} links`
            : "Graph view"
        }
      />
    );
    panels.settings = (
      <div className="divide-y divide-line">
        <DetailRow label="Vault">{vs?.vaultName ?? "—"}</DetailRow>
        <DetailRow label="Notes">{vs ? vs.notes.toLocaleString() : "—"}</DetailRow>
        <DetailRow label="Links">{vs ? vs.links.toLocaleString() : "—"}</DetailRow>
      </div>
    );
  }

  const tabs: TabDef[] = cfg.tabs.map((t) =>
    agentId === "codex" && t.id === "changes" ? { ...t, badge: detail.filesTouched?.length } : t,
  );

  return { tabs, panels, defaultId };
}

export function SessionWorkspace({
  agentId,
  cfg,
  initialSessions,
  initialDetail,
  realData,
  liveAgent,
  autoStartLive,
  memory,
  skills,
  jobs,
  notes,
  vaultStats,
}: {
  agentId: AgentId;
  cfg: AgentConfig;
  initialSessions: Session[];
  initialDetail: SessionDetail;
  /** Agent has a real session-history reader (claude-code, codex, hermes). */
  realData: boolean;
  /** Agent has a local CLI that can run live in a PTY (see cfg.liveCli / server.mjs). */
  liveAgent: boolean;
  /** Open a live PTY session automatically on mount (e.g. ?new=1 from Overview). */
  autoStartLive?: boolean;
  memory?: MemoryStore[];
  skills?: Skill[];
  jobs?: Job[];
  notes?: Note[];
  vaultStats?: { notes: number; links: number; vaultName: string };
}) {
  const [selectedId, setSelectedId] = useState(initialDetail.id);
  const [detail, setDetail] = useState<SessionDetail>(initialDetail);
  const [live, setLive] = useState(false);
  const [liveKey, setLiveKey] = useState(0); // bump to start a fresh PTY session
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const startLive = useCallback(() => {
    if (!liveAgent) return;
    setLiveKey((k) => k + 1);
    setLive(true);
  }, [liveAgent]);

  const stopLive = useCallback(() => setLive(false), []);

  // Auto-open a live session once when arriving via ?new=1.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStartLive && liveAgent && !autoStarted.current) {
      autoStarted.current = true;
      startLive();
    }
  }, [autoStartLive, liveAgent, startLive]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      if (id === selectedId) return;
      setSelectedId(id);
      setLive(false); // browsing history exits the live session
      setMenuOpen(false);
      if (!realData) return; // obsidian: note switch is local (no fetch)
      setLoading(true);
      try {
        const endpoint =
          agentId === "codex" ? `/api/codex/sessions/${id}`
          : agentId === "hermes" ? `/api/hermes/sessions/${id}`
          : `/api/claude-code/sessions/${id}`;
        const res = await fetch(endpoint);
        if (res.ok) {
          const d = (await res.json()) as SessionDetail;
          setDetail(d);
        }
      } catch {
        // best-effort — keep prior detail visible
      } finally {
        setLoading(false);
      }
    },
    [selectedId, agentId, realData],
  );

  const prompt = `${agentId}@${detail.workspace ?? "agentic-os"}:~$`;
  const termHeight = expanded ? "h-[640px]" : "h-[460px]";

  const terminalNode = live ? (
    <PtyTerminal
      key={liveKey}
      agentId={agentId}
      cwd={detail.sandbox}
      accent={cfg.accent}
      heightClass={termHeight}
      onClose={stopLive}
    />
  ) : (
    <Terminal transcript={detail.transcript} prompt={prompt} heightClass={termHeight} />
  );

  const selectedNote =
    agentId === "obsidian" ? notes?.find((n) => n.id === selectedId) ?? notes?.[0] : undefined;

  const { tabs, panels, defaultId } = buildPanels(agentId, cfg, detail, terminalNode, {
    memory,
    skills,
    jobs,
    notes,
    note: selectedNote,
    vaultStats,
  });

  const cardTitle = loading ? "Loading…" : live ? `Live · ${cfg.name}` : detail.title;

  return (
    <>
      <div className="xl:col-span-3 max-h-[740px]">
        <SessionList
          sessions={initialSessions}
          activeId={selectedId}
          onSelect={handleSelectSession}
          onNew={liveAgent ? startLive : undefined}
        />
      </div>

      <div className={expanded ? "xl:col-span-9" : "xl:col-span-6"}>
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex min-w-0 items-center gap-2">
                {loading ? (
                  <span className="flex items-center gap-1.5 text-sm text-faint">
                    <Icon name="Loader" size={14} className="animate-spin" />
                    Loading…
                  </span>
                ) : (
                  <>
                    <span className="truncate">{cardTitle}</span>
                    {live && (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-ok">
                        <span className="size-1.5 animate-pulse rounded-full bg-ok" /> Live
                      </span>
                    )}
                  </>
                )}
              </span>
            </CardTitle>
            <div className="relative flex shrink-0 items-center gap-1 text-faint">
              {liveAgent && !live && (
                <button
                  onClick={startLive}
                  className="flex items-center gap-1.5 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-90"
                >
                  <Icon name="Play" size={12} /> Start live session
                </button>
              )}
              {live && (
                <button
                  onClick={stopLive}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-ink"
                >
                  <Icon name="Square" size={12} /> Stop
                </button>
              )}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="grid size-7 place-items-center rounded-md hover:bg-surface-2 hover:text-muted"
                title={expanded ? "Restore" : "Maximize"}
              >
                <Icon name={expanded ? "Minimize2" : "Maximize2"} size={14} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="grid size-7 place-items-center rounded-md hover:bg-surface-2 hover:text-muted"
                >
                  <Icon name="MoreVertical" size={14} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-8 z-10 min-w-44 rounded-lg border border-line bg-surface-2 py-1 shadow-lg">
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-3"
                      onClick={() => {
                        void navigator.clipboard.writeText(detail.id);
                        setMenuOpen(false);
                      }}
                    >
                      Copy session ID
                    </button>
                    {detail.sandbox && (
                      <button
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-3"
                        onClick={() => {
                          void navigator.clipboard.writeText(detail.sandbox!);
                          setMenuOpen(false);
                        }}
                      >
                        Copy workspace path
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <Tabs tabs={tabs} panels={panels} defaultId={defaultId} />
            {!liveAgent && (
              <div className="mt-4">
                <ChatInput
                  agentId={agentId}
                  placeholder={`Message ${cfg.name}…`}
                  model={detail.model}
                  disabled
                  disabledHint={`${cfg.name} has no live CLI on this host`}
                />
                <p className="mt-1.5 text-center text-[11px] text-faint">
                  Shift + Enter for new line, Enter to send
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {!expanded && (
        <div className="xl:col-span-3">
          {agentId === "claude-code" && <ClaudeAside s={detail} />}
          {agentId === "codex" && <CodexAside s={detail} />}
          {agentId === "hermes" && <HermesAside memory={memory} skills={skills} jobs={jobs} />}
          {agentId === "obsidian" && <ObsidianAside notes={notes} vaultName={vaultStats?.vaultName} />}
        </div>
      )}
    </>
  );
}
