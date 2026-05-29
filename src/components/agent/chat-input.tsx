"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import type { AgentId } from "@/lib/types";

export function ChatInput({
  agentId,
  placeholder,
  model,
}: {
  agentId: AgentId;
  placeholder: string;
  model?: string;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const prompt = value.trim();
    if (!prompt || sending) return;
    setSending(true);
    try {
      // Demonstrates the write boundary; the mock provider returns a fake id.
      await fetch(`/api/agents/${agentId}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setValue("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-2.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        rows={1}
        placeholder={placeholder}
        className="max-h-32 w-full resize-none bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-faint focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-faint">
          <button className="grid size-7 place-items-center rounded-md hover:bg-surface-3 hover:text-muted">
            <Icon name="Paperclip" size={15} />
          </button>
          {model && (
            <span className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs">
              {model}
              <Icon name="ChevronDown" size={12} />
            </span>
          )}
        </div>
        <button
          onClick={() => void send()}
          disabled={!value.trim() || sending}
          className="grid size-8 place-items-center rounded-lg text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)" }}
          aria-label="Send"
        >
          <Icon name="SendHorizontal" size={16} />
        </button>
      </div>
    </div>
  );
}
