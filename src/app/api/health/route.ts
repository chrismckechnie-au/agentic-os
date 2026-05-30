import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fileExists(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function dirExists(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function resolveKanbanForHealth(): {
  dbPath: string;
  boardSlug?: string;
  resolution: string;
} {
  const home = process.env.HERMES_HOME || path.join(/* turbopackIgnore: true */ os.homedir(), ".hermes");
  const explicitDb = process.env.HERMES_KANBAN_DB?.trim();
  if (explicitDb) return { dbPath: explicitDb, resolution: "env-db" };

  const boardFromEnv = process.env.HERMES_KANBAN_BOARD?.trim();
  if (boardFromEnv) {
    return {
      dbPath: path.join(home, "kanban", "boards", boardFromEnv, "kanban.db"),
      boardSlug: boardFromEnv,
      resolution: "env-board",
    };
  }

  try {
    const current = fs.readFileSync(path.join(home, "kanban", "current"), "utf-8").trim();
    if (current) {
      return {
        dbPath: path.join(home, "kanban", "boards", current, "kanban.db"),
        boardSlug: current,
        resolution: "current-board",
      };
    }
  } catch {
    // fall through
  }

  const defaultBoard = path.join(home, "kanban", "boards", "default", "kanban.db");
  if (fileExists(defaultBoard)) {
    return { dbPath: defaultBoard, boardSlug: "default", resolution: "default-board" };
  }

  return { dbPath: path.join(home, "kanban.db"), resolution: "legacy-db" };
}

export async function GET() {
  const runtimeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const runtimeOk = Number.isFinite(runtimeMajor) && runtimeMajor >= 22;
  const host = process.env.AGENTIC_HOST ?? "127.0.0.1";
  const loopbackHost = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
  const vaultPath = process.env.VAULT_PATH?.trim() || null;
  const kanban = resolveKanbanForHealth();
  const checks = {
    runtime: { ok: runtimeOk, detail: process.version },
    bindHost: { ok: loopbackHost, detail: host },
    vault: { ok: vaultPath ? dirExists(vaultPath) : null, path: vaultPath },
    kanban: {
      ok: fileExists(kanban.dbPath),
      path: kanban.dbPath,
      boardSlug: kanban.boardSlug ?? null,
      resolution: kanban.resolution,
    },
  };

  return NextResponse.json({
    ok: checks.runtime.ok && checks.bindHost.ok,
    version: pkg.version,
    runtime: process.version,
    dataSourceMode: process.env.DATA_SOURCE ?? "mock",
    host,
    runRouteEnabled: /^(1|true)$/i.test(process.env.AGENTIC_ENABLE_RUN_ROUTE ?? ""),
    timestamp: new Date().toISOString(),
    checks,
  });
}
