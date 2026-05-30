// Server-only. Reads/writes ~/.agentic-os/config.json
import fs from "fs";
import path from "path";
import os from "os";
import { CLAUDE_PLANS, CODEX_PLANS, resolveTokens } from "./plans";

const CONFIG_PATH = path.join(os.homedir(), ".agentic-os", "config.json");

export interface AgentBudgetConfig {
  plan: string;
  custom?: number;
}

export interface UserConfig {
  tokenBudgets: {
    "claude-code": AgentBudgetConfig;
    codex: AgentBudgetConfig;
  };
}

const DEFAULTS: UserConfig = {
  tokenBudgets: {
    "claude-code": { plan: "pro" },
    codex: { plan: "free" },
  },
};

export function readUserConfig(): UserConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return DEFAULTS;
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<UserConfig>;
    return {
      tokenBudgets: {
        "claude-code": parsed.tokenBudgets?.["claude-code"] ?? DEFAULTS.tokenBudgets["claude-code"],
        codex: parsed.tokenBudgets?.codex ?? DEFAULTS.tokenBudgets.codex,
      },
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeUserConfig(config: UserConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/** Resolve monthly token budget numbers from stored plan config. */
export function resolvedBudgets(config: UserConfig): { "claude-code": number; codex: number } {
  return {
    "claude-code": resolveTokens(CLAUDE_PLANS, config.tokenBudgets["claude-code"].plan, config.tokenBudgets["claude-code"].custom),
    codex: resolveTokens(CODEX_PLANS, config.tokenBudgets.codex.plan, config.tokenBudgets.codex.custom),
  };
}
