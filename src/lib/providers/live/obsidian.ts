import "server-only";

import type { Note, Session, SessionDetail } from "@/lib/types";
import { readNotes } from "@/lib/obsidian/reader";

function relativeTime(value: string): { label: string; group: string } {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return { label: value, group: "Notes" };
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(diff / 86_400_000);

  let label: string;
  if (minutes < 1) label = "just now";
  else if (minutes < 60) label = `${minutes}m ago`;
  else if (minutes < 1_440) label = `${Math.floor(minutes / 60)}h ago`;
  else label = `${days}d ago`;

  let group: string;
  if (days === 0) group = "Today";
  else if (days === 1) group = "Yesterday";
  else if (days <= 7) group = "Previous 7 days";
  else group = "Earlier";

  return { label, group };
}

export async function listNotes(): Promise<Note[]> {
  return readNotes(200);
}

export function noteToSession(note: Note): Session {
  const { label, group } = relativeTime(note.updatedAt);
  return {
    id: note.id,
    agentId: "obsidian",
    title: note.title,
    status: "completed",
    updatedAt: label,
    group,
  };
}

export function noteToDetail(note: Note): SessionDetail {
  const session = noteToSession(note);
  return {
    ...session,
    title: note.title,
    workspace: note.group,
    transcript: [{ role: "agent", kind: "output", text: note.body }],
  };
}
