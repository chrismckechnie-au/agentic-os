import "server-only";

import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// Canonical, server-only path resolution for the live Hermes integration.
//
// Hermes stores its data under a home dir (default ~/.hermes). Within that home
// there is an *active profile* (~/.hermes/active_profile) whose chat history and
// state live in ~/.hermes/profiles/<profile>/state.db. The repo's first Hermes
// reader pointed at the *root* ~/.hermes/state.db which on a real install is an
// empty scaffold — so sessions never showed. This module centralises resolution
// so sessions, kanban and settings all agree on the same home/profile.
//
// Resolution honours explicit env overrides first, then the active profile, then
// a graceful fallback, so it works on a fresh box and on a fully-populated one.

/** Resolve the Hermes home: $HERMES_HOME or ~/.hermes. */
export function resolveHermesHome(): string {
  return process.env.HERMES_HOME || path.join(/* turbopackIgnore: true */ os.homedir(), ".hermes");
}

export function hermesAvailable(home = resolveHermesHome()): boolean {
  try {
    return fs.statSync(home).isDirectory();
  } catch {
    return false;
  }
}

/** The active profile name from ~/.hermes/active_profile, or null when unset. */
export function readActiveProfile(home = resolveHermesHome()): string | null {
  const fromEnv = process.env.HERMES_PROFILE?.trim();
  if (fromEnv) return fromEnv;
  try {
    const name = fs.readFileSync(path.join(home, "active_profile"), "utf-8").trim();
    return name || null;
  } catch {
    return null;
  }
}

/** Path to a named profile's state.db (existence not guaranteed). */
export function profileStateDb(profile: string, home = resolveHermesHome()): string {
  return path.join(home, "profiles", profile, "state.db");
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export interface StateDbResolution {
  dbPath: string;
  profile?: string;
  resolution: "env-db" | "profile" | "root";
}

/**
 * Resolve the chat-history state.db using Hermes' active-profile precedence:
 *   1. $HERMES_STATE_DB (explicit override)
 *   2. ~/.hermes/profiles/<active_profile>/state.db when it exists
 *   3. ~/.hermes/state.db (legacy / single-profile installs)
 */
export function resolveStateDbInfo(home = resolveHermesHome()): StateDbResolution {
  const explicit = process.env.HERMES_STATE_DB?.trim();
  if (explicit) return { dbPath: explicit, resolution: "env-db" };

  const profile = readActiveProfile(home);
  if (profile) {
    const candidate = profileStateDb(profile, home);
    if (isFile(candidate)) return { dbPath: candidate, profile, resolution: "profile" };
  }

  return { dbPath: path.join(home, "state.db"), resolution: "root" };
}

/** Convenience: just the resolved state.db path. */
export function resolveStateDb(home = resolveHermesHome()): string {
  return resolveStateDbInfo(home).dbPath;
}
