import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import type {
  FileTouched,
  Job,
  MemoryStore,
  Note,
  NoteLink,
  SessionDetail,
  VaultStats,
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

function memoryTotal(memory?: MemoryStore[]): string | null {
  if (!memory || memory.length === 0) return null;
  return memory.map((store) => store.size).join(" + ");
}

function EmptyCardMessage({ text }: { text: string }) {
  return (
    <p className="text-sm text-faint">{text}</p>
  );
}

function formatSandboxValue(s: SessionDetail): string | null {
  if (!s.sandbox) return null;
  if (s.workspace && s.sandbox === s.workspace) return null;
  return s.sandbox;
}

function FileTypeSummary({ files }: { files: FileTouched[] }) {
  const counts = new Map<string, number>();
  for (const file of files) counts.set(file.kind, (counts.get(file.kind) ?? 0) + 1);
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

/* -------------------------- Claude + Codex shared ------------------------- */

export function TerminalAgentAside({ s }: { s: SessionDetail }) {
  const sandboxValue = formatSandboxValue(s);
  const hasEnvironmentDetails = Boolean(
    s.branch || s.model || sandboxValue || s.permissions || s.estimate,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <CopyButton value={s.id} label="Copy ID" />
        </CardHeader>
        <CardBody className="pt-0">
          <div className="divide-y divide-line">
            <DetailRow label="Workspace">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="FolderGit2" size={13} className="text-faint" />
                {s.workspace}
              </span>
            </DetailRow>
            <DetailRow label="Status">{s.status}</DetailRow>
            {s.startedAt && <DetailRow label="Started">{s.startedAt}</DetailRow>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files Touched</CardTitle>
          <span className="text-xs text-faint">{s.filesTouched?.length ?? 0} files</span>
        </CardHeader>
        <CardBody className="pt-0">
          {s.filesTouched && s.filesTouched.length > 0 ? (
            <div className="space-y-3">
              <FileTypeSummary files={s.filesTouched} />
              <ChangedFiles files={s.filesTouched} />
            </div>
          ) : (
            <EmptyCardMessage text="No file activity has been recorded for this session." />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {hasEnvironmentDetails ? (
            <div className="divide-y divide-line">
              {s.branch && (
                <DetailRow label="Branch">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="GitBranch" size={13} className="text-faint" />
                    {s.branch}
                  </span>
                </DetailRow>
              )}
              {s.model && <DetailRow label="Model">{s.model}</DetailRow>}
              {sandboxValue && (
                <DetailRow label="Sandbox">
                  <span className="font-mono text-xs">{sandboxValue}</span>
                </DetailRow>
              )}
              {s.permissions && <DetailRow label="Permissions">{s.permissions}</DetailRow>}
              {s.estimate && <DetailRow label="Estimate">{s.estimate}</DetailRow>}
            </div>
          ) : (
            <EmptyCardMessage text="No environment metadata has been recorded for this session." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------------------------- Hermes -------------------------------- */

export function HermesAside({
  memory,
  jobs,
  s,
  hermesInfo,
}: {
  memory?: MemoryStore[];
  jobs?: Job[];
  s: SessionDetail;
  hermesInfo?: { profile?: string; home?: string };
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="divide-y divide-line">
            <DetailRow label="Active profile">{hermesInfo?.profile ?? "default"}</DetailRow>
            {s.model && <DetailRow label="Model">{s.model}</DetailRow>}
            <DetailRow label="Hermes home">
              <span className="font-mono text-xs">{hermesInfo?.home ?? "—"}</span>
            </DetailRow>
          </div>
        </CardBody>
      </Card>

      {memory && (
        <Card>
          <CardHeader>
            <CardTitle>Memory</CardTitle>
            <span className="text-xs text-faint">{memoryTotal(memory) ?? "No stores detected"}</span>
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

      {jobs && (
        <Card>
          <CardHeader>
            <CardTitle>Cron Jobs</CardTitle>
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

function notePath(note: Note): string {
  return note.path ?? note.id;
}

function normalizeClientKey(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function resolveLinkedNote(notes: Note[] | undefined, target: string): Note | undefined {
  if (!notes) return undefined;
  const key = normalizeClientKey(target.split("#")[0] ?? target);
  return notes.find((note) => {
    const pathValue = notePath(note);
    const basename = pathValue.split("/").pop()?.replace(/\.md$/i, "") ?? pathValue;
    return [note.id, pathValue, note.title, basename].some((value) => normalizeClientKey(value) === key);
  });
}

function renderInline(
  text: string,
  note?: Note,
  notes?: Note[],
  onSelectNote?: (id: string) => void,
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const linkRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;

  for (const match of text.matchAll(linkRe)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));

    const rawTarget = match[1];
    const label = match[2] ?? rawTarget;
    const knownLink = note?.outlinks?.find((link) => link.raw === match[0] || link.target === rawTarget);
    const resolved = knownLink?.resolvedId
      ? notes?.find((entry) => entry.id === knownLink.resolvedId)
      : resolveLinkedNote(notes, rawTarget);

    if (resolved && onSelectNote) {
      parts.push(
        <button
          key={`${index}-${rawTarget}`}
          onClick={() => onSelectNote(resolved.id)}
          className="rounded px-1 font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
        >
          {label}
        </button>,
      );
    } else {
      parts.push(
        <span key={`${index}-${rawTarget}`} className="rounded px-1 text-faint ring-1 ring-line">
          {label}
        </span>,
      );
    }
    last = index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type MarkdownBlock =
  | { kind: "code"; lang?: string; text: string; key: number }
  | { kind: "line"; text: string; key: number };

function markdownBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.split("\n");
  let codeLang: string | undefined;
  let codeLines: string[] = [];

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("```")) {
      if (codeLines.length > 0 || codeLang !== undefined) {
        blocks.push({ kind: "code", lang: codeLang, text: codeLines.join("\n"), key: i });
        codeLang = undefined;
        codeLines = [];
      } else {
        codeLang = line.slice(3).trim() || "text";
      }
      return;
    }

    if (codeLang !== undefined) {
      codeLines.push(raw);
      return;
    }

    blocks.push({ kind: "line", text: line, key: i });
  });

  if (codeLang !== undefined) {
    blocks.push({ kind: "code", lang: codeLang, text: codeLines.join("\n"), key: lines.length });
  }

  return blocks;
}

export function MarkdownLite({
  source,
  note,
  notes,
  onSelectNote,
}: {
  source: string;
  note?: Note;
  notes?: Note[];
  onSelectNote?: (id: string) => void;
}) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted">
      {markdownBlocks(source).map((block) => {
        if (block.kind === "code") {
          return (
            <pre key={block.key} className="overflow-x-auto rounded-lg border border-line bg-canvas/60 p-3 text-xs text-muted">
              <code>{block.text}</code>
            </pre>
          );
        }

        const line = block.text;
        if (!line) return <div key={block.key} className="h-1" />;
        if (line.startsWith("### ")) return <h3 key={block.key} className="pt-1 text-sm font-semibold text-ink">{renderInline(line.slice(4), note, notes, onSelectNote)}</h3>;
        if (line.startsWith("## ")) return <h2 key={block.key} className="pt-2 text-base font-semibold text-ink">{renderInline(line.slice(3), note, notes, onSelectNote)}</h2>;
        if (line.startsWith("# ")) return <h1 key={block.key} className="text-lg font-bold text-ink">{renderInline(line.slice(2), note, notes, onSelectNote)}</h1>;
        if (line.startsWith("- [x] "))
          return (
            <div key={block.key} className="flex items-center gap-2 text-muted">
              <Icon name="CircleCheck" size={15} className="text-ok" /> <span className="line-through">{renderInline(line.slice(6), note, notes, onSelectNote)}</span>
            </div>
          );
        if (line.startsWith("- [ ] "))
          return (
            <div key={block.key} className="flex items-center gap-2">
              <span className="size-3.5 rounded border border-line-strong" /> {renderInline(line.slice(6), note, notes, onSelectNote)}
            </div>
          );
        if (line.startsWith("- "))
          return (
            <div key={block.key} className="flex gap-2 pl-1">
              <span className="text-[var(--accent)]">•</span> <span>{renderInline(line.slice(2), note, notes, onSelectNote)}</span>
            </div>
          );
        return <p key={block.key}>{renderInline(line, note, notes, onSelectNote)}</p>;
      })}
    </div>
  );
}

export function NoteViewer({
  note,
  notes,
  onSelectNote,
}: {
  note: Note;
  notes?: Note[];
  onSelectNote?: (id: string) => void;
}) {
  const markdownLink = `[[${note.title}]]`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Icon name="FileText" size={15} className="text-[var(--accent)]" />
            {note.title}
          </span>
        </CardTitle>
        <div className="flex items-center gap-3">
          <CopyButton value={markdownLink} label="Copy link" />
          {note.obsidianUri && (
            <a
              href={note.obsidianUri}
              className="flex items-center gap-1 text-xs text-faint hover:text-muted"
            >
              <Icon name="ExternalLink" size={12} />
              Open
            </a>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-faint">
            {notePath(note)}
          </span>
          {(note.tags ?? []).map((tag) => (
            <span key={tag} className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">
              #{tag}
            </span>
          ))}
        </div>
        <MarkdownLite source={note.body} note={note} notes={notes} onSelectNote={onSelectNote} />
      </CardBody>
    </Card>
  );
}

function ConnectedNoteButton({
  note,
  onSelectNote,
  meta,
}: {
  note: Note;
  onSelectNote?: (id: string) => void;
  meta?: string;
}) {
  return (
    <button
      onClick={() => onSelectNote?.(note.id)}
      className="flex w-full items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left transition-colors hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)]"
    >
      <Icon name="FileText" size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{note.title}</span>
        <span className="block truncate text-[11px] text-faint">{meta ?? notePath(note)}</span>
      </span>
    </button>
  );
}

function uniqueLinkedNotes(note: Note, notes?: Note[]): Note[] {
  const ids = new Set<string>();
  for (const link of note.outlinks ?? []) {
    const id = link.resolvedId ?? resolveLinkedNote(notes, link.target)?.id;
    if (id && id !== note.id) ids.add(id);
  }
  for (const backlink of note.backlinks ?? []) ids.add(backlink.id);
  return [...ids].map((id) => notes?.find((entry) => entry.id === id)).filter((entry): entry is Note => Boolean(entry));
}

export function ObsidianGraph({
  note,
  notes,
  onSelectNote,
}: {
  note: Note;
  notes?: Note[];
  onSelectNote?: (id: string) => void;
}) {
  const connected = uniqueLinkedNotes(note, notes);
  const unresolved = (note.outlinks ?? []).filter((link) => !link.resolvedId);
  const totalNodes = connected.length + unresolved.length;
  const center = { x: 240, y: 150 };
  const radius = 105;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-line bg-surface-2 py-3">
          <div className="text-lg font-bold">{note.outlinks?.length ?? 0}</div>
          <div className="text-[11px] text-faint">Outlinks</div>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 py-3">
          <div className="text-lg font-bold">{note.backlinks?.length ?? 0}</div>
          <div className="text-[11px] text-faint">Backlinks</div>
        </div>
        <div className="rounded-lg border border-line bg-surface-2 py-3">
          <div className="text-lg font-bold">{unresolved.length}</div>
          <div className="text-[11px] text-faint">Unresolved</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-canvas/40">
        <svg viewBox="0 0 480 300" className="h-[300px] w-full">
          <defs>
            <radialGradient id="obsidian-node-glow">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {connected.map((entry, index) => {
            const angle = totalNodes <= 1 ? -Math.PI / 2 : (Math.PI * 2 * index) / totalNodes - Math.PI / 2;
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            return (
              <g key={entry.id}>
                <line x1={center.x} y1={center.y} x2={x} y2={y} stroke="var(--accent)" strokeOpacity="0.36" />
                <g
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => onSelectNote?.(entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onSelectNote?.(entry.id);
                  }}
                >
                  <circle cx={x} cy={y} r="26" fill="rgba(255,255,255,0.06)" stroke="var(--accent)" strokeOpacity="0.55" />
                  <text x={x} y={y + 3} textAnchor="middle" className="fill-ink text-[10px] font-semibold">
                    {entry.title.slice(0, 12)}
                  </text>
                </g>
              </g>
            );
          })}
          {unresolved.map((link, index) => {
            const offset = connected.length + index;
            const angle = totalNodes <= 1 ? Math.PI / 2 : (Math.PI * 2 * offset) / totalNodes - Math.PI / 2;
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            return (
              <g key={`${link.target}-${index}`}>
                <line x1={center.x} y1={center.y} x2={x} y2={y} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
                <circle cx={x} cy={y} r="22" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.22)" />
                <text x={x} y={y + 3} textAnchor="middle" className="fill-muted text-[9px]">
                  {link.label.slice(0, 10)}
                </text>
              </g>
            );
          })}
          <circle cx={center.x} cy={center.y} r="54" fill="url(#obsidian-node-glow)" />
          <circle cx={center.x} cy={center.y} r="36" fill="var(--accent-soft)" stroke="var(--accent)" />
          <text x={center.x} y={center.y + 4} textAnchor="middle" className="fill-ink text-[11px] font-bold">
            {note.title.slice(0, 16)}
          </text>
        </svg>
      </div>

      {connected.length === 0 && unresolved.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface-2 px-3 py-4 text-sm text-faint">
          This note has no resolved links or backlinks, so it is currently orphaned in the indexed vault graph.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-2">Connected Notes</p>
            <div className="space-y-2">
              {connected.map((entry) => (
                <ConnectedNoteButton key={entry.id} note={entry} onSelectNote={onSelectNote} />
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-2">Unresolved Links</p>
            <div className="space-y-2">
              {unresolved.length === 0 ? (
                <p className="rounded-lg border border-line bg-surface-2 px-3 py-4 text-sm text-faint">No unresolved links.</p>
              ) : (
                unresolved.map((link) => (
                  <div key={link.raw} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
                    {link.label}
                    <div className="font-mono text-[11px] text-faint">{link.target}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ObsidianBacklinks({
  note,
  notes,
  onSelectNote,
}: {
  note: Note;
  notes?: Note[];
  onSelectNote?: (id: string) => void;
}) {
  const backlinks = (note.backlinks ?? [])
    .map((link) => notes?.find((entry) => entry.id === link.id))
    .filter((entry): entry is Note => Boolean(entry));
  const outlinks = (note.outlinks ?? []).filter((link) => link.resolvedId);
  const unresolved = (note.outlinks ?? []).filter((link) => !link.resolvedId);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Backlinks</CardTitle>
          <span className="text-xs text-faint">{backlinks.length}</span>
        </CardHeader>
        <CardBody className="space-y-2 pt-0">
          {backlinks.length === 0 ? (
            <p className="text-sm text-faint">No notes link back to this note.</p>
          ) : (
            backlinks.map((entry) => (
              <ConnectedNoteButton key={entry.id} note={entry} onSelectNote={onSelectNote} meta={entry.excerpt} />
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outgoing Links</CardTitle>
          <span className="text-xs text-faint">{note.outlinks?.length ?? 0}</span>
        </CardHeader>
        <CardBody className="space-y-2 pt-0">
          {outlinks.map((link) => {
            const target = notes?.find((entry) => entry.id === link.resolvedId);
            return target ? (
              <ConnectedNoteButton key={link.raw} note={target} onSelectNote={onSelectNote} meta={link.label} />
            ) : null;
          })}
          {unresolved.map((link) => (
            <div key={link.raw} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
              {link.label}
              <div className="font-mono text-[11px] text-faint">Unresolved: {link.target}</div>
            </div>
          ))}
          {(note.outlinks?.length ?? 0) === 0 && <p className="text-sm text-faint">No outgoing wiki links.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

export function ObsidianMetadata({ note, vaultStats }: { note: Note; vaultStats?: VaultStats }) {
  const unresolved = (note.outlinks ?? []).filter((link: NoteLink) => !link.resolvedId).length;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Note Metadata</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="divide-y divide-line">
            <DetailRow label="Path"><span className="font-mono text-xs">{notePath(note)}</span></DetailRow>
            <DetailRow label="Folder">{note.folder ?? note.group ?? "Root"}</DetailRow>
            <DetailRow label="Updated">{note.updatedAt}</DetailRow>
            <DetailRow label="Tags">{(note.tags ?? []).length}</DetailRow>
            <DetailRow label="Tasks">{note.taskCounts ? `${note.taskCounts.open} open / ${note.taskCounts.total} total` : "—"}</DetailRow>
            <DetailRow label="Unresolved links">{unresolved}</DetailRow>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vault Index</CardTitle>
          <span className="text-xs text-faint">{vaultStats?.vaultName ?? "—"}</span>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="divide-y divide-line">
            <DetailRow label="Notes">{vaultStats ? vaultStats.notes.toLocaleString() : "—"}</DetailRow>
            <DetailRow label="Wiki links">{vaultStats ? vaultStats.links.toLocaleString() : "—"}</DetailRow>
            <DetailRow label="Tags">{vaultStats?.tags?.toLocaleString() ?? "—"}</DetailRow>
            <DetailRow label="Open tasks">{vaultStats?.openTasks?.toLocaleString() ?? "—"}</DetailRow>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export function ObsidianAside({ notes, vaultStats }: { notes?: Note[]; vaultStats?: VaultStats }) {
  const tags = new Map<string, number>();
  const folders = new Map<string, number>();
  for (const note of notes ?? []) {
    folders.set(note.folder ?? note.group ?? "Root", (folders.get(note.folder ?? note.group ?? "Root") ?? 0) + 1);
    for (const tag of note.tags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  const topTags = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topFolders = [...folders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vault</CardTitle>
          <span className="text-xs text-faint">{vaultStats?.vaultName ?? "Refuelr"}</span>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-line bg-surface-2 py-3">
              <div className="text-lg font-bold">{vaultStats?.notes.toLocaleString() ?? notes?.length ?? 0}</div>
              <div className="text-[11px] text-faint">Notes</div>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 py-3">
              <div className="text-lg font-bold">{vaultStats?.links.toLocaleString() ?? "—"}</div>
              <div className="text-[11px] text-faint">Links</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Folders</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <ul className="divide-y divide-line">
            {topFolders.map(([folder, count]) => (
              <li key={folder} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-muted">{folder}</span>
                <span className="text-xs text-faint">{count}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {topTags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-1.5 pt-0">
            {topTags.map(([tag, count]) => (
              <span key={tag} className="rounded-full border border-line bg-surface-2 px-2 py-1 text-xs text-muted">
                #{tag} <span className="text-faint">{count}</span>
              </span>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
