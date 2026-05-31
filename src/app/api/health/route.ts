import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { isIP } from "node:net";
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

function resolveTailscaleIp(): string | null {
  try {
    const out = execSync("tailscale ip -4", { stdio: ["ignore", "pipe", "ignore"], timeout: 2000 })
      .toString()
      .trim();
    return out.split(/\r?\n/).find((line) => isIP(line.trim()) === 4)?.trim() ?? null;
  } catch {
    return null;
  }
}

function resolveBindHost(value: string | undefined): {
  hostname: string;
  configured: string | null;
  source: string;
  ok: boolean;
} {
  const configured = value?.trim() || "";

  if (!configured) {
    return { hostname: "127.0.0.1", configured: null, source: "default-loopback", ok: true };
  }

  if (/^(tailscale|tailscale-ip|tailnet)$/i.test(configured)) {
    const tailscaleIp = resolveTailscaleIp();
    return tailscaleIp
      ? { hostname: tailscaleIp, configured, source: "tailscale", ok: true }
      : { hostname: "127.0.0.1", configured, source: "tailscale-unavailable", ok: false };
  }

  if (/^auto$/i.test(configured)) {
    const tailscaleIp = resolveTailscaleIp();
    return tailscaleIp
      ? { hostname: tailscaleIp, configured, source: "tailscale-auto", ok: true }
      : { hostname: "127.0.0.1", configured, source: "auto-loopback", ok: true };
  }

  return { hostname: configured, configured, source: "configured", ok: true };
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
  const bind = resolveBindHost(process.env.AGENTIC_HOST);
  const vaultPath = process.env.VAULT_PATH?.trim() || null;
  const kanban = resolveKanbanForHealth();
  const checks = {
    runtime: { ok: runtimeOk, detail: process.version },
    bindHost: {
      ok: bind.ok,
      detail: bind.hostname,
      configured: bind.configured,
      source: bind.source,
    },
    vault: { ok: vaultPath ? dirExists(vaultPath) : null, path: vaultPath },
    kanban: {
      ok: fileExists(kanban.dbPath),
      path: kanban.dbPath,
      boardSlug: kanban.boardSlug ?? null,
      resolution: kanban.resolution,
    },
  };

  const payload = {
    ok: checks.runtime.ok && checks.bindHost.ok,
    version: pkg.version,
    runtime: process.version,
    dataSourceMode: process.env.DATA_SOURCE ?? "mock",
    host: bind.hostname,
    configuredHost: bind.configured,
    runRouteEnabled: /^(1|true)$/i.test(process.env.AGENTIC_ENABLE_RUN_ROUTE ?? ""),
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
}
