"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, type TabDef } from "@/components/ui/tabs";
import { Icon } from "@/components/icon";
import { ObsidianNoteList, SessionList } from "@/components/agent/session-list";
import { ChatInput } from "@/components/agent/chat-input";
import { Terminal } from "@/components/agent/terminal";
import { PtyTerminal } from "@/components/agent/pty-terminal";
import { HermesMissionControl } from "@/components/hermes/mission-control";
import {
  ClaudeAside,
  CodexAside,
  HermesAside,
  NoteViewer,
  ObsidianAside,
  ObsidianBacklinks,
  ObsidianGraph,
  ObsidianMetadata,
} from "@/components/agent/panels";
import type {
  AgentId,
  HermesCrewDashboard,
  Job,
  MemoryStore,
  Note,
  Session,
  SessionDetail,
  VaultStats,
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
  terminalNode: React.ReactNode,
  extras: {
    notes?: Note[];
    note?: Note;
    vaultStats?: VaultStats;
    onSelectNote?: (noteId: string) => void;
  },
): { tabs: TabDef[]; panels: Record<string, React.ReactNode>; defaultId: string } {
  const panels: Record<string, React.ReactNode> = { session: terminalNode };
  let defaultId = "session";

  if (agentId === "obsidian") {
    defaultId = "notes";
    const note = extras.note ?? extras.notes?.[0];
    const vs = extras.vaultStats;
    panels.notes = note ? (
      <NoteViewer note={note} notes={extras.notes} onSelectNote={extras.onSelectNote} />
    ) : (
      <Placeholder icon="FileText" text="No note selected" />
    );
    panels.graph = note ? (
      <ObsidianGraph note={note} notes={extras.notes} onSelectNote={extras.onSelectNote} />
    ) : (
      <Placeholder icon="Network" text="No note selected" />
    );
    panels.backlinks = note ? (
      <ObsidianBacklinks note={note} notes={extras.notes} onSelectNote={extras.onSelectNote} />
    ) : (
      <Placeholder icon="Link2" text="No note selected" />
    );
    panels.settings = note ? (
      <ObsidianMetadata note={note} vaultStats={vs} />
    ) : (
      <Placeholder icon="Settings" text="No note selected" />
    );
  }

  return { tabs: cfg.tabs, panels, defaultId };
}

export function SessionWorkspace({
  agentId,
  cfg,
  initialSessions,
  initialDetail,
  realData,
  liveAgent,
  autoStartLive,
  autoResumeId,
  memory,
  jobs,
  notes,
  vaultStats,
  hermesInfo,
  hermesCrew,
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
  /** Resume a specific historical session automatically on mount. */
  autoResumeId?: string;
  memory?: MemoryStore[];
  jobs?: Job[];
  notes?: Note[];
  vaultStats?: VaultStats;
  /** Hermes workspace settings (active profile, home) for the Settings tab. */
  hermesInfo?: { profile?: string; home?: string };
  hermesCrew?: HermesCrewDashboard;
}) {
  const [selectedId, setSelectedId] = useState(initialDetail.id);
  const [detail, setDetail] = useState<SessionDetail>(initialDetail);
  const [live, setLive] = useState(false);
  const [liveKey, setLiveKey] = useState(0); // bump to start a fresh PTY session
  const [resumeId, setResumeId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const startLive = useCallback(() => {
    if (!liveAgent) return;
    setResumeId(undefined); // a fresh session, not a resume
    setLiveKey((k) => k + 1);
    setLive(true);
  }, [liveAgent]);

  const stopLive = useCallback(() => setLive(false), []);

  // Resume a past session in the live Chat terminal (from Sessions tab or a
  // Kanban task's linked session). Switches to the Chat tab and starts a PTY
  // with --resume <id>.
  const resumeInChat = useCallback(
    (sessionId: string) => {
      if (!liveAgent) return;
      setResumeId(sessionId);
      setLiveKey((k) => k + 1);
      setLive(true);
      setActiveTab("session");
    },
    [liveAgent],
  );

  // Auto-open a live session once when arriving via ?new=1 or a history resume link.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoResumeId && liveAgent && !autoStarted.current) {
      autoStarted.current = true;
      setResumeId(autoResumeId);
      setLiveKey((k) => k + 1);
      setLive(true);
      return;
    }
    if (autoStartLive && liveAgent && !autoStarted.current) {
      autoStarted.current = true;
      startLive();
    }
  }, [autoResumeId, autoStartLive, liveAgent, startLive]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      if (id === selectedId) return;
      setSelectedId(id);
      setLive(false); // browsing history exits the live session
      setMenuOpen(false);
      if (!realData) {
        if (agentId === "obsidian") {
          const note = notes?.find((entry) => entry.id === id);
          const session = initialSessions.find((entry) => entry.id === id);
          if (note) {
            setDetail({
              id: note.id,
              agentId: "obsidian",
              title: note.title,
              workspace: note.folder ?? note.group,
              status: "completed",
              updatedAt: session?.updatedAt ?? detail.updatedAt,
              group: session?.group ?? note.group,
              transcript: [{ role: "agent", kind: "output", text: note.body }],
            });
          }
        }
        return;
      }
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
    [selectedId, agentId, detail.updatedAt, initialSessions, notes, realData],
  );

  const prompt = `${agentId}@${detail.workspace ?? "agentic-os"}:~$`;
  const termHeight = expanded ? "h-[640px]" : "h-[460px]";

  const terminalNode = live ? (
    <PtyTerminal
      key={liveKey}
      agentId={agentId}
      cwd={detail.sandbox}
      resumeId={resumeId}
      accent={cfg.accent}
      heightClass={termHeight}
      onClose={stopLive}
    />
  ) : (
    <Terminal transcript={detail.transcript} prompt={prompt} heightClass={termHeight} />
  );

  const selectedNote =
    agentId === "obsidian" ? notes?.find((n) => n.id === selectedId) ?? notes?.[0] : undefined;

  const { tabs, panels, defaultId } = buildPanels(agentId, cfg, terminalNode, {
    notes,
    note: selectedNote,
    vaultStats,
    onSelectNote: handleSelectSession,
  });

  const cardTitle = loading ? "Loading…" : live ? `Live · ${cfg.name}` : detail.title;
  const historyHref = `/sessions?agent=${agentId}`;

  return (
    <>
      <div className="xl:col-span-3 max-h-[740px]">
        {agentId === "obsidian" ? (
          <ObsidianNoteList notes={notes ?? []} activeId={selectedId} onSelect={handleSelectSession} />
        ) : (
          <SessionList
            sessions={initialSessions}
            activeId={selectedId}
            onSelect={handleSelectSession}
            onNew={liveAgent ? startLive : undefined}
            title="Recent Sessions"
          />
        )}
      </div>

      <div className={expanded ? "xl:col-span-9" : "xl:col-span-6"}>
        <Card>
          <CardHeader className="flex-wrap items-start">
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
            <div className="relative flex w-full flex-wrap items-center justify-end gap-1 text-faint sm:w-auto">
              {agentId !== "obsidian" && (
                <Link
                  href={historyHref}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-[var(--accent-line)] hover:text-[var(--accent)]"
                >
                  <Icon name="MessageSquare" size={12} />
                  <span className="hidden sm:inline">Previous Sessions</span>
                  <span className="sm:hidden">History</span>
                </Link>
              )}
              {liveAgent && !live && (
                <button
                  onClick={startLive}
                  className="flex items-center gap-1.5 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-90"
                >
                  <Icon name="Play" size={12} />
                  <span className="hidden sm:inline">Start live session</span>
                  <span className="sm:hidden">Start</span>
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
            <Tabs
              tabs={tabs}
              panels={panels}
              defaultId={defaultId}
              activeId={activeTab ?? defaultId}
              onActiveChange={setActiveTab}
            />
            {!liveAgent && agentId !== "obsidian" && (
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
        <div className="space-y-6 xl:col-span-3">
          {agentId === "claude-code" && <ClaudeAside s={detail} />}
          {agentId === "codex" && <CodexAside s={detail} />}
          {agentId === "hermes" && hermesCrew && (
            <HermesMissionControl dashboard={hermesCrew} framed onOpenSession={resumeInChat} />
          )}
          {agentId === "hermes" && <HermesAside memory={memory} jobs={jobs} s={detail} hermesInfo={hermesInfo} />}
          {agentId === "obsidian" && <ObsidianAside notes={notes} vaultStats={vaultStats} />}
        </div>
      )}
    </>
  );
}
