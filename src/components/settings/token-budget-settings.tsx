"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { CLAUDE_PLANS, CODEX_PLANS, resolveTokens, type Plan } from "@/lib/config/plans";

interface AgentBudget { plan: string; custom?: number; }
interface BudgetState { "claude-code": AgentBudget; codex: AgentBudget; }

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function PlanSelect({
  label,
  plans,
  value,
  onChange,
}: {
  label: string;
  plans: Plan[];
  value: AgentBudget;
  onChange: (v: AgentBudget) => void;
}) {
  const resolved = resolveTokens(plans, value.plan, value.custom);

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-faint">{fmtTok(resolved)} tokens/mo</p>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={value.plan}
          onChange={(e) => onChange({ plan: e.target.value, custom: value.custom })}
          className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-[var(--accent)] cursor-pointer"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.price}
            </option>
          ))}
        </select>
        {value.plan === "custom" && (
          <input
            type="number"
            min={10000}
            step={100000}
            value={value.custom ?? 1_000_000}
            onChange={(e) => onChange({ plan: "custom", custom: Number(e.target.value) })}
            className="w-28 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-sm text-ink focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            placeholder="tokens"
          />
        )}
      </div>
    </div>
  );
}

export function TokenBudgetSettings() {
  const [budgets, setBudgets] = useState<BudgetState>({
    "claude-code": { plan: "pro" },
    codex: { plan: "free" },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/config/token-budget")
      .then((r) => r.json())
      .then((d) => { if (d.plans) setBudgets(d.plans); })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/config/token-budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(budgets),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="divide-y divide-line">
        <PlanSelect
          label="Claude Code"
          plans={CLAUDE_PLANS}
          value={budgets["claude-code"]}
          onChange={(v) => setBudgets((b) => ({ ...b, "claude-code": v }))}
        />
        <PlanSelect
          label="Codex"
          plans={CODEX_PLANS}
          value={budgets.codex}
          onChange={(v) => setBudgets((b) => ({ ...b, codex: v }))}
        />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-faint">
          Saved to <code className="font-mono text-[var(--accent)]">~/.agentic-os/config.json</code>
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:opacity-90 disabled:opacity-50"
        >
          <Icon name={saved ? "Check" : "Save"} size={13} />
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
