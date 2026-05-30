"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import "@xterm/xterm/css/xterm.css";

type Status = "connecting" | "open" | "closed";

/**
 * Live terminal that mirrors the Hermes dashboard chat pane: it opens a
 * WebSocket to /api/pty, where the server runs the agent's real CLI behind a
 * PTY, and renders the raw ANSI stream with xterm.js (WebGL renderer + fit
 * addon). xterm owns its own scrollbar inside a fixed-height container, so the
 * terminal never stretches the page.
 */
export function PtyTerminal({
  agentId,
  cwd,
  resumeId,
  accent,
  heightClass = "h-[460px]",
  onClose,
}: {
  agentId: string;
  cwd?: string;
  resumeId?: string;
  accent: string;
  heightClass?: string;
  onClose?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let disposed = false;
    let term: import("@xterm/xterm").Terminal | null = null;
    let ws: WebSocket | null = null;
    let ro: ResizeObserver | null = null;
    let fit: import("@xterm/addon-fit").FitAddon | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }, { WebglAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-webgl"),
      ]);
      if (disposed) return;

      const monoVar = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-geist-mono")
        .trim();
      const fontFamily = monoVar
        ? `${monoVar}, ui-monospace, Menlo, Consolas, monospace`
        : "ui-monospace, Menlo, Consolas, monospace";

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily,
        scrollback: 5000,
        theme: {
          background: "#080a0d",
          foreground: "#edeef2",
          cursor: accent,
          cursorAccent: "#080a0d",
          selectionBackground: "rgba(255,255,255,0.18)",
          black: "#0b0d11",
          brightBlack: "#646b78",
        },
      });

      fit = new FitAddon();
      term.loadAddon(fit);
      term.open(el);
      try {
        term.loadAddon(new WebglAddon());
      } catch {
        // WebGL unavailable — fall back to the default DOM renderer.
      }
      try {
        fit.fit();
      } catch {
        /* container not measured yet */
      }

      const proto = location.protocol === "https:" ? "wss" : "ws";
      const params = new URLSearchParams({
        agent: agentId,
        cols: String(term.cols),
        rows: String(term.rows),
      });
      if (cwd) params.set("cwd", cwd);
      if (resumeId) params.set("resume", resumeId);
      ws = new WebSocket(`${proto}://${location.host}/api/pty?${params.toString()}`);

      ws.onopen = () => {
        if (disposed) return;
        setStatus("open");
        term?.focus();
        send({ type: "resize", cols: term!.cols, rows: term!.rows });
      };
      ws.onmessage = (e) => {
        if (typeof e.data === "string") term?.write(e.data);
        else if (e.data instanceof ArrayBuffer) term?.write(new Uint8Array(e.data));
      };
      ws.onclose = () => {
        if (disposed) return;
        setStatus("closed");
      };
      ws.onerror = () => {
        if (disposed) return;
        setStatus("closed");
      };

      function send(frame: Record<string, unknown>) {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
      }

      term.onData((data) => send({ type: "input", data }));

      ro = new ResizeObserver(() => {
        try {
          fit?.fit();
          if (term) send({ type: "resize", cols: term.cols, rows: term.rows });
        } catch {
          /* mid-teardown */
        }
      });
      ro.observe(el);
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      try {
        ws?.close();
      } catch {
        /* noop */
      }
      try {
        term?.dispose();
      } catch {
        /* noop */
      }
    };
    // Mount once per (agent, cwd, resume) session. Changing these starts a new session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, cwd, resumeId]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#080a0d]">
      <div className="flex items-center justify-between border-b border-line/80 px-3 py-1.5">
        <span className="flex items-center gap-2 text-[11px] text-faint">
          <Icon name="SquareTerminal" size={13} color={accent} />
          <span className="font-mono">{agentId} · live PTY</span>
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-medium",
            status === "open" && "text-ok",
            status === "connecting" && "text-faint",
            status === "closed" && "text-faint",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "open" && "animate-pulse bg-ok",
              status === "connecting" && "animate-pulse bg-warn",
              status === "closed" && "bg-faint",
            )}
          />
          {status === "open" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected"}
          {status === "closed" && onClose && (
            <button onClick={onClose} className="ml-2 text-faint underline hover:text-ink">
              close
            </button>
          )}
        </span>
      </div>
      <div ref={mountRef} className={cn("w-full p-2", heightClass)} />
    </div>
  );
}
