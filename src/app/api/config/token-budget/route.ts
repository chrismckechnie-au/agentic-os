import { NextResponse } from "next/server";
import { readUserConfig, writeUserConfig, resolvedBudgets } from "@/lib/config/user-config";

export function GET() {
  const config = readUserConfig();
  return NextResponse.json({
    plans: config.tokenBudgets,
    resolved: resolvedBudgets(config),
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    "claude-code"?: { plan: string; custom?: number };
    codex?: { plan: string; custom?: number };
  };
  const config = readUserConfig();
  if (body["claude-code"]) config.tokenBudgets["claude-code"] = body["claude-code"];
  if (body.codex) config.tokenBudgets.codex = body.codex;
  writeUserConfig(config);
  return NextResponse.json({
    plans: config.tokenBudgets,
    resolved: resolvedBudgets(config),
  });
}
