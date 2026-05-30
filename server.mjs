// Custom Next.js server that adds a PTY-over-WebSocket endpoint at /api/pty,
// mirroring the Hermes dashboard: spawn a real CLI behind a pseudo-terminal and
// stream its ANSI output to xterm.js in the browser.
//
// This file is NOT processed by the Next.js compiler — keep it plain Node ESM,
// compatible with the running Node version. node-pty / ws are required directly
// here (server-only) so they never enter the client bundle.

import { createServer } from "node:http";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import next from "next";
import { WebSocketServer } from "ws";
import pty from "node-pty";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3017", 10);
const hostname = process.env.AGENTIC_HOST || "127.0.0.1";
const isWin = process.platform === "win32";

const app = next({ dev });
const handle = app.getRequestHandler();
const packageJson = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
const runRouteEnabled = /^(1|true)$/i.test(process.env.AGENTIC_ENABLE_RUN_ROUTE ?? "");

// ── Agent allowlist (authoritative — never trust the client) ────────────────
// Each agent maps to a fixed binary + base args. `resume(id)` appends history flags.
const AGENTS = {
  "claude-code": { bin: "claude", base: [], resume: (id) => ["--resume", id] },
  codex: { bin: "codex", base: [], resume: (id) => ["resume", id] },
  hermes: { bin: "hermes", base: ["--tui"], resume: (id) => ["--resume", id] },
};

function splitRoots(value) {
  return value ? value.split(path.delimiter).map((root) => root.trim()).filter(Boolean) : [];
}

function buildAllowedRoots(roots) {
  return roots
    .map((root) => {
    try {
      return fs.realpathSync(path.resolve(root));
    } catch {
      return null;
    }
  })
    .filter(Boolean);
}

// PTY cwd allowlist roots. Keep execution narrower than read-only app data roots.
const PTY_ALLOWED_ROOTS = buildAllowedRoots([
  process.cwd(),
  ...splitRoots(process.env.AGENTIC_PTY_ALLOWED_ROOTS),
]);

function withinRoot(target, root) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveCwd(requested) {
  if (!requested) return { ok: true, cwd: process.cwd() };
  try {
    const resolved = fs.realpathSync(path.resolve(requested));
    const ok = PTY_ALLOWED_ROOTS.some((root) => withinRoot(resolved, root));
    if (ok && fs.statSync(resolved).isDirectory()) return { ok: true, cwd: resolved };
  } catch {
    /* fall through */
  }
  return {
    ok: false,
    cwd: process.cwd(),
    message: "Requested workspace is not allowed for live PTY sessions.",
  };
}

function fileExists(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function dirExists(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function resolveKanbanForHealth() {
  const home = process.env.HERMES_HOME || path.join(os.homedir(), ".hermes");
  const explicitDb = process.env.HERMES_KANBAN_DB?.trim();
  if (explicitDb) {
    return { dbPath: explicitDb, resolution: "env-db" };
  }

  const boardFromEnv = process.env.HERMES_KANBAN_BOARD?.trim();
  if (boardFromEnv) {
    return {
      dbPath: path.join(home, "kanban", "boards", boardFromEnv, "kanban.db"),
      boardSlug: boardFromEnv,
      resolution: "env-board",
    };
  }

  const currentFile = path.join(home, "kanban", "current");
  try {
    const current = fs.readFileSync(currentFile, "utf-8").trim();
    if (current) {
      return {
        dbPath: path.join(home, "kanban", "boards", current, "kanban.db"),
        boardSlug: current,
        resolution: "current-board",
      };
    }
  } catch {
    /* fall through */
  }

  const defaultBoard = path.join(home, "kanban", "boards", "default", "kanban.db");
  if (fileExists(defaultBoard)) {
    return { dbPath: defaultBoard, boardSlug: "default", resolution: "default-board" };
  }

  return { dbPath: path.join(home, "kanban.db"), resolution: "legacy-db" };
}

function healthPayload() {
  const runtimeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  const runtimeOk = Number.isFinite(runtimeMajor) && runtimeMajor >= 22;
  const loopbackHost = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
  const vaultPath = process.env.VAULT_PATH?.trim() || null;
  const kanban = resolveKanbanForHealth();

  const checks = {
    runtime: { ok: runtimeOk, detail: process.version },
    bindHost: { ok: loopbackHost, detail: hostname },
    vault: { ok: vaultPath ? dirExists(vaultPath) : null, path: vaultPath },
    kanban: {
      ok: fileExists(kanban.dbPath),
      path: kanban.dbPath,
      boardSlug: kanban.boardSlug ?? null,
      resolution: kanban.resolution,
    },
  };

  return {
    ok: checks.runtime.ok && checks.bindHost.ok,
    version: packageJson.version,
    runtime: process.version,
    dataSourceMode: process.env.DATA_SOURCE ?? "mock",
    host: hostname,
    runRouteEnabled,
    timestamp: new Date().toISOString(),
    checks,
  };
}

function sendHealth(res) {
  const payload = healthPayload();
  res.statusCode = payload.ok ? 200 : 503;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

// Resolve a binary to an absolute path via the OS, or null if not installed.
// On Windows, `where` lists several matches (an extensionless shell shim plus
// .cmd/.exe/.ps1); CreateProcess/cmd can only launch the executable variants,
// so prefer those over the extensionless shim.
function resolveBin(bin) {
  try {
    const cmd = isWin ? `where ${bin}` : `command -v ${bin}`;
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const lines = out.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return null;
    if (!isWin) return lines[0];
    const runnable = [".cmd", ".bat", ".exe", ".com"];
    return lines.find((l) => runnable.includes(path.extname(l).toLowerCase())) ?? lines[0];
  } catch {
    return null;
  }
}

// Only allow safe resume identifiers (uuid / slug style) — they may end up on a
// command line on Windows.
function safeResumeId(id) {
  return typeof id === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(id) ? id : null;
}

// Same-origin guard: the page and the socket must share an origin.
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin || !req.headers.host) return false;
  try {
    const o = new URL(origin);
    return o.host === req.headers.host;
  } catch {
    return false;
  }
}

function startPtySession(ws, params) {
  const agentId = params.get("agent");
  const spec = AGENTS[agentId];

  const term = (msg) => {
    try {
      ws.send(`\x1b[38;5;244m${msg}\x1b[0m\r\n`);
    } catch {
      /* socket gone */
    }
  };

  if (!spec) {
    term(`Unknown agent "${agentId}".`);
    ws.close();
    return;
  }

  const file = resolveBin(spec.bin);
  if (!file) {
    ws.send(
      `\x1b[38;5;203m${spec.bin}: command not found.\x1b[0m\r\n` +
        `\x1b[38;5;244mThis agent's CLI isn't installed on this host. ` +
        `It will launch on the machine where "${spec.bin}" is available.\x1b[0m\r\n`,
    );
    ws.close();
    return;
  }

  const cwdResult = resolveCwd(params.get("cwd") || undefined);
  if (!cwdResult.ok) {
    term(cwdResult.message);
    ws.close();
    return;
  }
  const cwd = cwdResult.cwd;
  const resumeId = safeResumeId(params.get("resume"));
  const cols = Math.max(20, Math.min(500, parseInt(params.get("cols") || "80", 10) || 80));
  const rows = Math.max(5, Math.min(200, parseInt(params.get("rows") || "24", 10) || 24));
  const args = [...spec.base, ...(resumeId ? spec.resume(resumeId) : [])];

  const env = { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", FORCE_COLOR: "1" };

  // On Windows, npm-installed CLIs are usually .cmd shims that CreateProcess
  // can't launch directly — route them through cmd.exe. POSIX spawns directly.
  let spawnFile = file;
  let spawnArgs = args;
  if (isWin) {
    // Pass the path as its own argv entry — node-pty quotes it (handling spaces).
    // Pre-quoting here would get double-quoted and break cmd's parsing.
    spawnFile = process.env.ComSpec || "cmd.exe";
    spawnArgs = ["/c", file, ...args];
  }

  let child;
  try {
    child = pty.spawn(spawnFile, spawnArgs, { name: "xterm-color", cols, rows, cwd, env });
  } catch (err) {
    term(`Failed to start ${spec.bin}: ${err?.message ?? err}`);
    ws.close();
    return;
  }

  child.onData((data) => {
    try {
      ws.send(data);
    } catch {
      /* socket closed mid-write */
    }
  });

  child.onExit(({ exitCode }) => {
    try {
      ws.send(`\r\n\x1b[38;5;244m[process exited with code ${exitCode}]\x1b[0m\r\n`);
      ws.close();
    } catch {
      /* already closed */
    }
  });

  ws.on("message", (raw) => {
    let frame;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      return; // all client→server messages are framed JSON
    }
    if (frame.type === "input" && typeof frame.data === "string") {
      child.write(frame.data);
    } else if (frame.type === "resize") {
      const c = Math.max(20, Math.min(500, Number(frame.cols) || cols));
      const r = Math.max(5, Math.min(200, Number(frame.rows) || rows));
      try {
        child.resize(c, r);
      } catch {
        /* race on teardown */
      }
    }
  });

  const kill = () => {
    try {
      child.kill();
    } catch {
      /* already dead */
    }
  };
  ws.on("close", kill);
  ws.on("error", kill);
}

app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler(); // Next's own upgrade (HMR, etc.) — must be after prepare()
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${port}`}`);
    if (pathname === "/api/health") {
      sendHealth(res);
      return;
    }
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws, req) => {
    const { searchParams } = new URL(req.url, "http://localhost");
    startPtySession(ws, searchParams);
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/api/pty") {
      if (!originAllowed(req)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      // Everything else (Next HMR websocket, etc.) goes to Next.
      upgradeHandler(req, socket, head);
    }
  });

  server.listen(port, hostname, () => {
    console.log(
      `> Agentic OS ready on http://localhost:${port} (${dev ? "development" : "production"}) — PTY at /api/pty`,
    );
  });
});
