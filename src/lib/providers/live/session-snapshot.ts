import "server-only";

import type { Session } from "@/lib/types";
import {
  readSessions as readClaudeSessions,
  type ClaudeSession,
} from "@/lib/claude-code/reader";
import {
  readSessions as readCodexSessions,
  type CodexSession,
} from "@/lib/codex/reader";
import {
  getStateDbHealth,
  readSessions as readHermesSessions,
} from "@/lib/hermes/state";
import { readNotes } from "@/lib/obsidian/reader";
import { noteToSession } from "@/lib/providers/live/obsidian";
import { readThroughCache } from "@/lib/server/cache";

const SNAPSHOT_TTL_MS = 30_000;
const SESSION_LIMIT_PER_AGENT = 100;
const NOTE_LIMIT = 50;

export interface LiveSessionSnapshot {
  claude: ClaudeSession[];
  codex: CodexSession[];
  hermes: Session[];
  obsidian: Session[];
  all: Session[];
}

export function toBaseSession(session: ClaudeSession | CodexSession): Session {
  return {
    id: session.id,
    agentId: session.agentId,
    title: session.title,
    workspace: session.workspace ?? undefined,
    status: session.status,
    updatedAt: session.updatedAt,
    group: session.group,
  };
}

function sessionWeight(value: string): number {
  if (value === "just now") return 0;
  const minutes = value.match(/^(\d+)m/);
  if (minutes) return Number(minutes[1]);
  const hours = value.match(/^(\d+)h/);
  if (hours) return Number(hours[1]) * 60;
  const days = value.match(/^(\d+)d/);
  if (days) return Number(days[1]) * 1_440;
  const weeks = value.match(/^(\d+)w/);
  if (weeks) return Number(weeks[1]) * 10_080;
  if (value === "Yesterday") return 1_440;
  return Number.MAX_SAFE_INTEGER;
}

function loadSnapshot(): LiveSessionSnapshot {
  const claude = (() => {
    try {
      return readClaudeSessions(SESSION_LIMIT_PER_AGENT);
    } catch {
      return [];
    }
  })();

  const codex = (() => {
    try {
      return readCodexSessions(SESSION_LIMIT_PER_AGENT);
    } catch {
      return [];
    }
  })();

  const hermes = (() => {
    try {
      return getStateDbHealth().readable ? readHermesSessions(SESSION_LIMIT_PER_AGENT) : [];
    } catch {
      return [];
    }
  })();

  const obsidian = (() => {
    try {
      return readNotes(NOTE_LIMIT).map(noteToSession);
    } catch {
      return [];
    }
  })();

  const all = [
    ...claude.map(toBaseSession),
    ...codex.map(toBaseSession),
    ...hermes,
    ...obsidian,
  ].sort((left, right) => sessionWeight(left.updatedAt) - sessionWeight(right.updatedAt));

  return { claude, codex, hermes, obsidian, all };
}

export function readLiveSessionSnapshot(): LiveSessionSnapshot {
  return readThroughCache("live:session-snapshot", SNAPSHOT_TTL_MS, loadSnapshot);
}
