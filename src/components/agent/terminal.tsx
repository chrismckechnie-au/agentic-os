import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { SessionMessage } from "@/lib/types";

function Line({ msg }: { msg: SessionMessage }) {
  switch (msg.kind) {
    case "prompt":
      return (
        <div className="my-1 rounded-lg border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-ink">
          <span className="mr-2 text-[var(--accent)]">&gt;</span>
          <span className="whitespace-pre-wrap">{msg.text}</span>
        </div>
      );
    case "success":
      return (
        <div className="flex items-start gap-2 text-ok">
          <Icon name="CircleCheck" size={14} className="mt-0.5 shrink-0" />
          <span>{msg.text}</span>
        </div>
      );
    case "error":
      return <div className="text-danger">✗ {msg.text}</div>;
    case "step":
      return (
        <div className="text-muted">
          <span className="mr-2 text-[var(--accent)]">▸</span>
          {msg.text}
        </div>
      );
    case "skill":
      return (
        <div className="text-muted">
          <span className="mr-2 text-faint">[skill]</span>
          {msg.text}
        </div>
      );
    case "job":
      return (
        <div className="text-[var(--accent)]">
          <span className="mr-2">[job]</span>
          {msg.text}
        </div>
      );
    case "info":
      return <div className="text-faint">{msg.text}</div>;
    default:
      return <div className="whitespace-pre-wrap text-muted">{msg.text}</div>;
  }
}

export function Terminal({
  transcript,
  prompt = "agent@agentic-os:~$",
  className,
}: {
  transcript: SessionMessage[];
  prompt?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-auto rounded-xl border border-line bg-[#080a0d] p-4 font-mono text-[12.5px] leading-6",
        className,
      )}
    >
      <div className="space-y-0.5">
        {transcript.map((m, i) => (
          <Line key={i} msg={m} />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-ok">
        <span>{prompt}</span>
        <span className="inline-block h-4 w-2 animate-pulse bg-ok/80" />
      </div>
    </div>
  );
}
