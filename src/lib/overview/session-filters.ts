import type { Session } from "../types";

export function isHermesCronSession(session: Session): boolean {
  if (session.agentId !== "hermes") return false;
  const workspace = session.workspace?.trim().toLowerCase() ?? "";
  const id = session.id.trim().toLowerCase();
  const title = session.title.trim().toLowerCase();
  return workspace.startsWith("cron") || id.startsWith("cron_") || title.startsWith("conversation cron_");
}

export function filterNonCronSessions<T extends Session>(sessions: T[]): T[] {
  return sessions.filter((session) => !isHermesCronSession(session));
}
