"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { Icon } from "@/components/icon";
import type { AgentId } from "@/lib/types";

export interface ChatInputHandle {
  focus: () => void;
}

export function ChatInput({
  agentId,
  placeholder,
  model,
  onSend,
  running,
  disabled,
  disabledHint,
  handleRef,
}: {
  agentId: AgentId;
  placeholder: string;
  model?: string;
  /** When provided, sending streams via this callback instead of the mock POST. */
  onSend?: (prompt: string) => Promise<void> | void;
  /** External busy flag (e.g. a stream is in flight). */
  running?: boolean;
  /** Hard-disable the composer (e.g. agent has no live CLI). */
  disabled?: boolean;
  disabledHint?: string;
  handleRef?: Ref<ChatInputHandle>;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(handleRef, () => ({ focus: () => textareaRef.current?.focus() }), []);

  const busy = sending || !!running;

  const send = async () => {
    const prompt = value.trim();
    if (!prompt || busy || disabled) return;
    setSending(true);
    try {
      if (onSend) {
        await onSend(prompt);
      } else {
        // Demonstrates the write boundary; the mock provider returns a fake id.
        await fetch(`/api/agents/${agentId}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
      }
      setValue("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-2.5">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        rows={1}
        placeholder={disabled ? (disabledHint ?? placeholder) : placeholder}
        className="max-h-32 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-faint focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-faint">
          {model && (
            <span className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs">
              {model}
              <Icon name="ChevronDown" size={12} />
            </span>
          )}
        </div>
        <button
          onClick={() => void send()}
          disabled={!value.trim() || busy || disabled}
          className="grid size-8 place-items-center rounded-lg text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)" }}
          aria-label="Send"
        >
          {busy ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="SendHorizontal" size={16} />}
        </button>
      </div>
    </div>
  );
}
