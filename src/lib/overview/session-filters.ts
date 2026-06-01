import type { Session } from "../types";

export function isHermesCronSession(session: Session): boolean {
  return session.agentId === "hermes" && session.workspace?.trim().toLowerCase() === "cron";
}

export function filterOverviewSessions<T extends Session>(sessions: T[]): T[] {
  return sessions.filter((session) => !isHermesCronSession(session));
}
