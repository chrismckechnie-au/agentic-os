import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isWin = process.platform === "win32";

// Only these agents map to a real local CLI.
const BINARIES: Record<string, string> = {
  "claude-code": "claude",
  codex: "codex",
};

// cwd allowlist roots — client-supplied cwd must resolve under one of these.
const ALLOWED_ROOTS = [process.cwd(), os.homedir(), "F:\\Development", "/home", "/Users"];

function resolveCwd(requested?: string): string {
  const fallback = process.cwd();
  if (!requested) return fallback;
  try {
    const resolved = path.resolve(requested);
    const ok = ALLOWED_ROOTS.some((root) => resolved.toLowerCase().startsWith(path.resolve(root).toLowerCase()));
    if (ok && fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) return resolved;
  } catch {
    // fall through
  }
  return fallback;
}

function buildArgs(agent: string, resumeId?: string): string[] {
  if (agent === "claude-code") {
    // prompt arrives via stdin (text input); flags only here.
    return ["-p", "--output-format", "stream-json", "--include-partial-messages", "--verbose"];
  }
  // codex: read prompt from stdin via the "-" sentinel.
  return resumeId ? ["exec", "resume", resumeId, "--json", "-"] : ["exec", "--json", "-"];
}

// Extract a human-readable delta from one parsed stdout line, per agent.
function extractClaude(line: string): { text?: string; step?: string; done?: boolean } | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  const type = obj.type;
  if (type === "result") return { done: true };
  if (type === "stream_event") {
    const event = obj.event as Record<string, unknown> | undefined;
    const et = event?.type;
    if (et === "content_block_delta") {
      const delta = event?.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") return { text: delta.text };
    }
    if (et === "content_block_start") {
      const block = event?.content_block as Record<string, unknown> | undefined;
      if (block?.type === "tool_use" && typeof block.name === "string") return { step: block.name as string };
    }
  }
  return null;
}

function extractCodex(line: string): { text?: string; step?: string; done?: boolean } | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line);
  } catch {
    // Non-JSON line — forward raw text.
    return line.trim() ? { text: line } : null;
  }
  // Best-effort across codex exec --json event shapes.
  const msg = obj.msg as Record<string, unknown> | undefined;
  const t = (obj.type ?? msg?.type) as string | undefined;
  if (t === "task_complete" || t === "turn.completed") return { done: true };
  const candidates = [obj.message, obj.text, obj.delta, msg?.message, msg?.text, msg?.delta];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return { text: c };
  }
  const item = obj.item as Record<string, unknown> | undefined;
  if (item && typeof item.text === "string" && item.text.trim()) return { text: item.text };
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  const bin = BINARIES[agent];
  if (!bin) {
    return Response.json({ available: false, error: "No CLI for this agent" }, { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as { prompt?: string; cwd?: string; resumeId?: string };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: "Missing prompt" }, { status: 400 });
  }

  const cwd = resolveCwd(body.cwd);
  const args = buildArgs(agent, body.resumeId);
  const extract = agent === "claude-code" ? extractClaude : extractCodex;

  const encoder = new TextEncoder();
  let child: ChildProcessWithoutNullStreams | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        child = spawn(bin, args, { cwd, shell: isWin }) as ChildProcessWithoutNullStreams;
      } catch {
        send("error", { message: `Failed to start ${bin}` });
        controller.close();
        return;
      }

      send("start", { agent, cwd });

      // Feed the prompt via stdin so it never touches the shell command line.
      child.stdin.write(prompt);
      child.stdin.end();

      let stdoutBuf = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuf += chunk.toString("utf-8");
        const lines = stdoutBuf.split("\n");
        stdoutBuf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const out = extract(line);
          if (!out) continue;
          if (out.text) send("delta", { text: out.text });
          if (out.step) send("step", { text: out.step });
          if (out.done) send("done", {});
        }
      });

      let stderrBuf = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString("utf-8");
      });

      child.on("error", (err: Error) => {
        // ENOENT etc. — binary not available.
        send("error", { message: err.message, available: false });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });

      child.on("close", (code: number | null) => {
        if (stdoutBuf.trim()) {
          const out = extract(stdoutBuf);
          if (out?.text) send("delta", { text: out.text });
        }
        if (code !== 0 && stderrBuf.trim()) {
          send("error", { message: stderrBuf.slice(0, 500), code });
        }
        send("done", { code });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      // Client disconnected — kill the child process.
      child?.kill();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
