import type { HermesCrewDashboard } from "@/lib/types";
import { HermesMissionControlClient } from "./mission-control-client";

export function HermesMissionControl({
  dashboard,
  framed = false,
  onOpenSession,
}: {
  dashboard: HermesCrewDashboard;
  framed?: boolean;
  onOpenSession?: (sessionId: string) => void;
}) {
  return <HermesMissionControlClient dashboard={dashboard} framed={framed} onOpenSession={onOpenSession} />;
}
