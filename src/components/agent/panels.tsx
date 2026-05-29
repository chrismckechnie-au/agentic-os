import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { compact, cn } from "@/lib/utils";
import type {
  Commit,
  FileTouched,
  Job,
  MemoryStore,
  Note,
  SessionDetail,
  Skill,
} from "@/lib/types";

/* --------------------------------- shared -------------------------------- */

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-faint">{label}</span>
      <span className="text-right font-medium text-ink">{children}</span>
    </div>
  );
}

const CHANGE_TONE: Record<NonNullable<FileTouched["change"]>, string> = {
  A: "text-ok",
  M: "text-warn",
  D: "text-danger",
};

export function ChangedFiles({ files }: { files: FileTouched[] }) {
  return (
    <ul className="space-y-1 font-mono text-[12.5px]">
      {files.map((f) => (
        <li key={f.name} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-2/60">
          <span className="flex items-center gap-2 text-muted">
            <Icon name="FileText" size={13} className="text-faint" />
            {f.name}
          </span>
          {f.change && <span className={cn("font-semibold", CHANGE_TONE[f.change])}>{f.change}</span>}
        </li>
      ))}
    </ul>
  );
}

export function PlanList({ plan }: { plan: NonNullable<SessionDetail["plan"]> }) {
  return (
    <ol className="space-y-1.5">
      {plan.map((step, i) => (
        <li
          key={i}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
            step.current ? "border-[var(--accent-line)] bg-[var(--accent-soft)]" : "border-transparent",
          )}
        >
          {step.done ? (
            <Icon name="CircleCheck" size={16} className="text-ok" />
          ) : step.current ? (
            <span className="size-4 rounded-full border-2 border-[var(--accent)]" />
          ) : (
            <span className="size-4 rounded-full border-2 border-line-strong" />
          )}
          <span className={cn(step.done ? "text-muted line-through" : "text-ink")}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function CommitList({ commits }: { commits: Commit[] }) {
  return (
    <ul className="space-y-2.5">
      {commits.map((c) => (
        <li key={c.sha} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-[var(--accent)]">
            {c.sha}
          </span>
          <span className="min-w-0 flex-1 text-muted">{c.message}</span>
          <span className="shrink-0 text-xs text-faint">{c.when}</span>
        </li>
      ))}
    </ul>
  );
}

function FileTypeChips({ files }: { files: FileTouched[] }) {
  const counts = new Map<string, number>();
  for (const f of files) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  return (
    <div className="flex flex-wrap gap-1.5">
      {[...counts.entries()].map(([kind, n]) => (
        <span key={kind} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted">
          {kind} {n}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------- Claude Code ------------------------------ */

export function ClaudeAside({ s }: { s: SessionDetail }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <button className="flex items-center gap-1 text-xs text-faint hover:text-muted">
            <Icon name="Copy" size={12} /> Copy ID
          </button>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="divide-y divide-line">
            <DetailRow label="Workspace">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="FolderGit2" size={13} className="text-faint" />
                {s.workspace}
              </span>
            </DetailRow>
            {s.branch && (
              <DetailRow label="Branch">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="GitBranch" size={13} className="text-faint" />
                  {s.branch}
                </span>
              </DetailRow>
            )}
            {s.model && <DetailRow label="Model">{s.model}</DetailRow>}
            {s.startedAt && <DetailRow label="Started">{s.startedAt}</DetailRow>}
          </div>
        </CardBody>
      </Card>

      {s.totalTokens && (
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="divide-y divide-line">
              <DetailRow label="Tokens In">{compact(s.tokensIn ?? 0)}</DetailRow>
              <DetailRow label="Tokens Out">{compact(s.tokensOut ?? 0)}</DetailRow>
              <DetailRow label="Total Tokens">{compact(s.totalTokens)}</DetailRow>
            </div>
            {typeof s.contextPct === "number" && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${s.contextPct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-faint">{s.contextPct}% of 1M context window</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {s.filesTouched && (
        <Card>
          <CardHeader>
            <CardTitle>Files Touched</CardTitle>
            <span className="text-xs text-faint">{s.filesTouched.length} files</span>
          </CardHeader>
          <CardBody className="pt-0">
            <FileTypeChips files={s.filesTouched} />
          </CardBody>
        </Card>
      )}

      {s.commits && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Commits</CardTitle>
            <span className="text-xs text-[var(--accent)]">View all</span>
          </CardHeader>
          <CardBody className="pt-0">
            <CommitList commits={s.commits} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------- Codex --------------------------------- */

export function CodexAside({ s }: { s: SessionDetail }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Task Details</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="divide-y divide-line">
            <DetailRow label="Repository">{s.workspace}</DetailRow>
            {s.branch && <DetailRow label="Branch">{s.branch}</DetailRow>}
            {s.model && <DetailRow label="Model">{s.model}</DetailRow>}
            {s.sandbox && <DetailRow label="Sandbox">{s.sandbox}</DetailRow>}
            {s.permissions && <DetailRow label="Permissions">{s.permissions}</DetailRow>}
            {s.startedAt && <DetailRow label="Started">{s.startedAt}</DetailRow>}
            {s.estimate && (
              <DetailRow label="Estimated">
                <span className="text-[var(--accent)]">{s.estimate}</span>
              </DetailRow>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-3 gap-2 pt-0 text-center">
          <div className="rounded-lg border border-line bg-surface-2 py-3">
            <div className="text-lg font-bold">{s.filesTouched?.length ?? 0}</div>
            <div className="text-[11px] text-faint">Files</div>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 py-3">
            <div className="text-lg font-bold text-ok">42/42</div>
            <div className="text-[11px] text-faint">Tests</div>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 py-3">
            <div className="text-lg font-bold">1</div>
            <div className="text-[11px] text-faint">Commits</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------------------------- Hermes -------------------------------- */

export function HermesAside({
  memory,
  skills,
  jobs,
}: {
  memory?: MemoryStore[];
  skills?: Skill[];
  jobs?: Job[];
}) {
  return (
    <div className="space-y-6">
      {memory && (
        <Card>
          <CardHeader>
            <CardTitle>Memory</CardTitle>
            <span className="text-xs text-faint">2.43 GB / 8 GB</span>
          </CardHeader>
          <CardBody className="space-y-3 pt-0">
            {memory.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">{m.label}</span>
                  <span className="font-medium">{m.size}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${m.pct ?? 0}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {skills && (
        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <span className="text-xs text-faint">{skills.length} active</span>
          </CardHeader>
          <CardBody className="pt-0">
            <ul className="divide-y divide-line">
              {skills.map((sk) => (
                <li key={sk.name} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-mono text-muted">{sk.name}</span>
                  <Badge tone={sk.status === "active" ? "ok" : "muted"}>{sk.status}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {jobs && (
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <span className="text-xs text-faint">{jobs.length} total</span>
          </CardHeader>
          <CardBody className="pt-0">
            <ul className="divide-y divide-line">
              {jobs.map((j) => (
                <li key={j.name} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-mono text-muted">{j.name}</span>
                    {j.schedule && <div className="font-mono text-[11px] text-faint">{j.schedule}</div>}
                  </div>
                  <Badge tone={j.status === "running" ? "ok" : j.status === "completed" ? "info" : "muted"}>
                    {j.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------- Obsidian ------------------------------- */

export function MarkdownLite({ source }: { source: string }) {
  const lines = source.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line) return <div key={i} className="h-1" />;
        if (line.startsWith("### ")) return <h3 key={i} className="pt-1 text-sm font-semibold text-ink">{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} className="pt-2 text-base font-semibold text-ink">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold text-ink">{line.slice(2)}</h1>;
        if (line.startsWith("- [x] "))
          return (
            <div key={i} className="flex items-center gap-2 text-muted">
              <Icon name="CircleCheck" size={15} className="text-ok" /> <span className="line-through">{line.slice(6)}</span>
            </div>
          );
        if (line.startsWith("- [ ] "))
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="size-3.5 rounded border border-line-strong" /> {line.slice(6)}
            </div>
          );
        if (line.startsWith("- "))
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-[var(--accent)]">•</span> {line.slice(2)}
            </div>
          );
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export function NoteViewer({ note }: { note: Note }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Icon name="FileText" size={15} className="text-[var(--accent)]" />
            {note.title}
          </span>
        </CardTitle>
        <div className="flex items-center gap-1 text-faint">
          <button className="grid size-7 place-items-center rounded-md hover:bg-surface-2 hover:text-muted">
            <Icon name="ExternalLink" size={14} />
          </button>
        </div>
      </CardHeader>
      <CardBody>
        <MarkdownLite source={note.body} />
      </CardBody>
    </Card>
  );
}

export function ObsidianAside({ notes }: { notes?: Note[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault</CardTitle>
        <span className="text-xs text-faint">Refuelr</span>
      </CardHeader>
      <CardBody className="pt-0">
        <ul className="divide-y divide-line">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-2 text-muted">
                <Icon name="FileText" size={14} className="text-faint" />
                {n.title}
              </span>
              <span className="text-xs text-faint">{n.updatedAt}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
