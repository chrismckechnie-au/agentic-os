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
const hostname = process.env.HOSTNAME || "127.0.0.1";
const isWin = process.platform === "win32";

const app = next({ dev });
const handle = app.getRequestHandler();

// ── Agent allowlist (authoritative — never trust the client) ────────────────
// Each agent maps to a fixed binary + base args. `resume(id)` appends history flags.
const AGENTS = {
  "claude-code": { bin: "claude", base: [], resume: (id) => ["--resume", id] },
  codex: { bin: "codex", base: [], resume: (id) => ["resume", id] },
  hermes: { bin: "hermes", base: ["--tui"], resume: (id) => ["--resume", id] },
};

// cwd allowlist roots — a client-supplied cwd must resolve under one of these.
const ALLOWED_ROOTS = [
  process.cwd(),
  os.homedir(),
  ...(isWin ? ["F:\\Development"] : ["/home", "/Users"]),
  ...(process.env.AGENTIC_ALLOWED_ROOTS
    ? process.env.AGENTIC_ALLOWED_ROOTS.split(path.delimiter).filter(Boolean)
    : []),
];

function resolveCwd(requested) {
  const fallback = process.cwd();
  if (!requested) return fallback;
  try {
    const resolved = path.resolve(requested);
    const ok = ALLOWED_ROOTS.some((root) =>
      resolved.toLowerCase().startsWith(path.resolve(root).toLowerCase()),
    );
    if (ok && fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) return resolved;
  } catch {
    /* fall through */
  }
  return fallback;
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

// Same-origin guard: the page and the socket must share an origin. Also permit
// loopback explicitly. Blocks cross-site WebSocket hijacking.
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser client
  try {
    const o = new URL(origin);
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(o.hostname)) return true;
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

  const cwd = resolveCwd(params.get("cwd") || undefined);
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
  const server = createServer((req, res) => handle(req, res));

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
