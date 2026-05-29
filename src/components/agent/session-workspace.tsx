"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, type TabDef } from "@/components/ui/tabs";
import { Icon } from "@/components/icon";
import { SessionList } from "@/components/agent/session-list";
import { ChatInput, type ChatInputHandle } from "@/components/agent/chat-input";
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
import type {
  AgentId,
  Job,
  MemoryStore,
  Note,
  Session,
  SessionDetail,
  SessionMessage,
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
  transcript: SessionMessage[],
  extras: { memory?: MemoryStore[]; skills?: Skill[]; jobs?: Job[]; notes?: Note[] },
): { tabs: TabDef[]; panels: Record<string, React.ReactNode>; defaultId: string } {
  const prompt = `${agentId}@${detail.workspace ?? "agentic-os"}:~$`;
  const term = <Terminal transcript={transcript} prompt={prompt} />;
  const panels: Record<string, React.ReactNode> = { terminal: term };
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
    panels.logs = term;
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
    panels.notes = extras.notes?.[0] ? (
      <NoteViewer note={extras.notes[0]} />
    ) : (
      <Placeholder icon="FileText" text="No note selected" />
    );
    panels.graph = <Placeholder icon="Network" text="Graph view — 1,284 notes · 9,612 links" />;
    panels.settings = (
      <div className="divide-y divide-line">
        <DetailRow label="Vault">Refuelr</DetailRow>
        <DetailRow label="Notes">1,284</DetailRow>
        <DetailRow label="Sync">Enabled</DetailRow>
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
  memory,
  skills,
  jobs,
  notes,
}: {
  agentId: AgentId;
  cfg: AgentConfig;
  initialSessions: Session[];
  initialDetail: SessionDetail;
  realData: boolean;
  memory?: MemoryStore[];
  skills?: Skill[];
  jobs?: Job[];
  notes?: Note[];
}) {
  const [selectedId, setSelectedId] = useState(initialDetail.id);
  const [detail, setDetail] = useState<SessionDetail>(initialDetail);
  const [liveTranscript, setLiveTranscript] = useState<SessionMessage[]>([]);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newSession, setNewSession] = useState(false);
  const inputHandleRef = useRef<ChatInputHandle>(null);

  const handleSelectSession = useCallback(
    async (id: string) => {
      if (id === selectedId) return;
      setSelectedId(id);
      setLiveTranscript([]);
      setNewSession(false);
      setMenuOpen(false);
      if (!realData) return;
      setLoading(true);
      try {
        const endpoint =
          agentId === "codex" ? `/api/codex/sessions/${id}` : `/api/claude-code/sessions/${id}`;
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

  const handleSend = useCallback(
    async (prompt: string) => {
      setNewSession(false);
      setLiveTranscript((prev) => [
        ...prev,
        { role: "user" as const, kind: "prompt" as const, text: prompt },
      ]);
      setRunning(true);

      let res: Response;
      try {
        res = await fetch(`/api/agents/${agentId}/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, cwd: detail.sandbox }),
        });
      } catch {
        setLiveTranscript((prev) => [
          ...prev,
          { role: "system" as const, kind: "error" as const, text: "Network error" },
        ]);
        setRunning(false);
        return;
      }

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setLiveTranscript((prev) => [
          ...prev,
          { role: "system" as const, kind: "error" as const, text: errText || `HTTP ${res.status}` },
        ]);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const flush = (part: string) => {
        const lines = part.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          if (line.startsWith("data: ")) data = line.slice(6).trim();
        }
        if (!data) return;
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(data) as Record<string, unknown>;
        } catch {
          return;
        }
        if (event === "delta" && typeof payload.text === "string") {
          setLiveTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last?.kind === "output" && last.role === "agent") {
              return [...prev.slice(0, -1), { ...last, text: last.text + (payload.text as string) }];
            }
            return [...prev, { role: "agent" as const, kind: "output" as const, text: payload.text as string }];
          });
        } else if (event === "step" && typeof payload.text === "string") {
          setLiveTranscript((prev) => [
            ...prev,
            { role: "agent" as const, kind: "step" as const, text: payload.text as string },
          ]);
        } else if (event === "done") {
          setRunning(false);
        } else if (event === "error") {
          setLiveTranscript((prev) => [
            ...prev,
            {
              role: "system" as const,
              kind: "error" as const,
              text: typeof payload.message === "string" ? payload.message : "Error from agent",
            },
          ]);
          setRunning(false);
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            if (part.trim()) flush(part);
          }
        }
      } finally {
        setRunning(false);
      }
    },
    [agentId, detail.sandbox],
  );

  const handleNewSession = useCallback(() => {
    setSelectedId("");
    setLiveTranscript([]);
    setNewSession(true);
    setTimeout(() => inputHandleRef.current?.focus(), 50);
  }, []);

  const transcript = newSession ? [] : liveTranscript.length > 0 ? liveTranscript : detail.transcript;
  const { tabs, panels, defaultId } = buildPanels(agentId, cfg, detail, transcript, {
    memory,
    skills,
    jobs,
    notes,
  });

  const isMock = !realData;
  const cardTitle = loading ? "Loading…" : newSession ? "New session" : detail.title;

  return (
    <>
      <div className="xl:col-span-3">
        <SessionList
          sessions={initialSessions}
          activeId={selectedId}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
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
                    {running && (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-ok">
                        <span className="size-1.5 animate-pulse rounded-full bg-ok" /> Live
                      </span>
                    )}
                  </>
                )}
              </span>
            </CardTitle>
            <div className="relative flex shrink-0 items-center gap-1 text-faint">
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
            <div className="mt-4">
              <ChatInput
                agentId={agentId}
                placeholder={`Message ${cfg.name}…`}
                model={detail.model}
                onSend={isMock ? undefined : handleSend}
                running={running}
                disabled={isMock}
                disabledHint={`${cfg.name} is a mock agent — no live CLI`}
                handleRef={inputHandleRef}
              />
              <p className="mt-1.5 text-center text-[11px] text-faint">
                Shift + Enter for new line, Enter to send
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {!expanded && (
        <div className="xl:col-span-3">
          {agentId === "claude-code" && <ClaudeAside s={detail} />}
          {agentId === "codex" && <CodexAside s={detail} />}
          {agentId === "hermes" && <HermesAside memory={memory} skills={skills} jobs={jobs} />}
          {agentId === "obsidian" && <ObsidianAside notes={notes} />}
        </div>
      )}
    </>
  );
}
