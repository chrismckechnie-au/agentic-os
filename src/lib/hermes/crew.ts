import "server-only";

import fs from "node:fs";
import path from "node:path";
import { buildHermesCrewDashboard, type CrewJobSource, type CrewProfileSource } from "./crew-core";
import { crewActionsEnabled, readMissionControlActionHistory, readMissionControlAcks, readMissionControlEvents } from "./mission-control-db";
import { hermesAvailable, readActiveProfile, resolveHermesHome } from "./paths";
import { kanbanWritesEnabled } from "./kanban-write";
import { readNotes } from "../obsidian/reader";
import { readTasks } from "../providers/live/hermes-kanban";
import type { HermesCrewDashboard, KanbanTask } from "../types";
import { HERMES_CREW } from "../config/hermes-crew";

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf-8");
  } catch {
    return null;
  }
}

function readJson(file: string): unknown {
  const raw = readText(file);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function profileRoot(home: string, profile: string): string {
  return path.join(home, "profiles", profile);
}

function profileLastActivity(profileHome: string): number | undefined {
  const candidates = [
    path.join(profileHome, "state.db"),
    path.join(profileHome, "cron", "jobs.json"),
    path.join(profileHome, "gateway_state.json"),
    path.join(profileHome, "profile.yaml"),
  ];
  const times = candidates
    .map((candidate) => {
      try {
        return fs.statSync(candidate).mtimeMs;
      } catch {
        return 0;
      }
    })
    .filter((value) => value > 0);
  return times.length > 0 ? Math.max(...times) : undefined;
}

function configValue(raw: string | null, key: string): string | undefined {
  if (!raw) return undefined;
  const re = new RegExp(`^\\s*${key}:\\s*['"]?([^'"\\r\\n#]+)`, "m");
  const match = raw.match(re);
  return match?.[1]?.trim() || undefined;
}

function fallbackModel(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const fallback = raw.match(/fallback_providers:[\s\S]*?model:\s*['"]?([^'"\r\n#]+)/);
  return fallback?.[1]?.trim() || undefined;
}

function normalizeProfileId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Resolve a crew profile's on-disk directory. Prefers an exact id match, but
// tolerates hyphenation drift between the config id and the actual profile
// folder (e.g. config "refuelrops" vs. on-disk "refuelr-ops") so a renamed
// profile doesn't get reported as "missing".
function resolveProfileDir(home: string, id: string): string | undefined {
  const exact = profileRoot(home, id);
  if (isDirectory(exact)) return exact;

  const profilesDir = path.join(home, "profiles");
  let entries: string[];
  try {
    entries = fs.readdirSync(profilesDir);
  } catch {
    return undefined;
  }
  const target = normalizeProfileId(id);
  const match = entries.find((entry) => normalizeProfileId(entry) === target);
  if (!match) return undefined;
  const resolved = path.join(profilesDir, match);
  return isDirectory(resolved) ? resolved : undefined;
}

function readProfileSources(home: string): CrewProfileSource[] {
  return HERMES_CREW.map((def) => {
    const root = resolveProfileDir(home, def.id);
    const exists = root !== undefined;
    const config = exists ? readText(path.join(root, "config.yaml")) : null;
    return {
      id: def.id,
      exists,
      home: root,
      model: configValue(config, "default"),
      fallbackModel: fallbackModel(config),
      provider: configValue(config, "provider"),
      lastActivityMs: exists ? profileLastActivity(root) : undefined,
    };
  });
}

function readChannelNames(home: string, activeProfile?: string): Map<string, string> {
  const file = activeProfile
    ? path.join(home, "profiles", activeProfile, "channel_directory.json")
    : path.join(home, "channel_directory.json");
  const payload = readJson(file) as
    | {
        platforms?: {
          discord?: { id?: string; name?: string; type?: string }[];
        };
      }
    | null;
  const names = new Map<string, string>();
  for (const entry of payload?.platforms?.discord ?? []) {
    const rawName = entry.name ?? "";
    const simple = rawName.includes("#")
      ? rawName.split("#").pop()?.split(/[ /\n]/)[0]
      : rawName;
    const name = simple?.replace(/^#/, "").trim().toLowerCase();
    if (name && !name.includes(":")) names.set(name, String(entry.id ?? name));
  }
  return names;
}

function readJobSources(home: string, activeProfile?: string): CrewJobSource[] {
  const file = activeProfile
    ? path.join(home, "profiles", activeProfile, "cron", "jobs.json")
    : path.join(home, "cron", "jobs.json");
  const payload = readJson(file) as { jobs?: CrewJobSource[] } | CrewJobSource[] | null;
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.jobs) ? payload.jobs : [];
}

function rawGatewaySource(home: string, activeProfile?: string) {
  const file = activeProfile
    ? path.join(home, "profiles", activeProfile, "gateway_state.json")
    : path.join(home, "gateway_state.json");
  return readJson(file) as
    | {
        gateway_state?: string;
        active_agents?: number;
        platforms?: Record<string, { state?: string }>;
      }
    | null;
}

function readLiveTasks(): KanbanTask[] {
  try {
    return readTasks();
  } catch {
    return [];
  }
}

export function readHermesCrewDashboard(home = resolveHermesHome()): HermesCrewDashboard {
  const activeProfile = readActiveProfile(home) ?? undefined;
  if (!hermesAvailable(home)) {
    return buildHermesCrewDashboard({
      hermesHome: home,
      activeProfile,
      profiles: [],
      channelNames: new Map(),
      jobs: [],
      tasks: [],
      notes: [],
      gateway: undefined,
      actions: {
        kanbanWritesEnabled: kanbanWritesEnabled(),
        crewActionsEnabled: crewActionsEnabled(),
        cronActionsEnabled: crewActionsEnabled(),
      },
    });
  }

  const gateway = rawGatewaySource(home, activeProfile);
  return buildHermesCrewDashboard({
    hermesHome: home,
    activeProfile,
    profiles: readProfileSources(home),
    channelNames: readChannelNames(home, activeProfile),
    jobs: readJobSources(home, activeProfile),
    tasks: readLiveTasks(),
    notes: readNotes(160),
    loggedEvents: readMissionControlEvents(),
    ackedEventIds: readMissionControlAcks(),
    actionHistory: readMissionControlActionHistory(),
    gateway: gateway ?? undefined,
    actions: {
      kanbanWritesEnabled: kanbanWritesEnabled(),
      crewActionsEnabled: crewActionsEnabled(),
      cronActionsEnabled: crewActionsEnabled(),
    },
  });
}
