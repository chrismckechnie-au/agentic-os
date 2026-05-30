export interface Plan {
  id: string;
  label: string;
  price: string;
  tokens: number; // estimated monthly token budget
}

export const CLAUDE_PLANS: Plan[] = [
  { id: "free",    label: "Free",       price: "$0/mo",   tokens: 100_000 },
  { id: "pro",     label: "Pro",        price: "$20/mo",  tokens: 500_000 },
  { id: "max-5x",  label: "Max 5×",     price: "$100/mo", tokens: 2_500_000 },
  { id: "max-20x", label: "Max 20×",    price: "$200/mo", tokens: 10_000_000 },
  { id: "custom",  label: "Custom",     price: "Manual",  tokens: 0 },
];

export const CODEX_PLANS: Plan[] = [
  { id: "free",    label: "Free",      price: "$0/mo",   tokens: 50_000 },
  { id: "plus",    label: "Plus",      price: "$20/mo",  tokens: 500_000 },
  { id: "pro-5x",  label: "Pro 5×",    price: "$100/mo", tokens: 2_500_000 },
  { id: "pro-20x", label: "Pro 20×",   price: "$200/mo", tokens: 10_000_000 },
  { id: "custom",  label: "Custom",    price: "Manual",  tokens: 0 },
];

export function resolveTokens(
  plans: Plan[],
  planId: string,
  custom?: number,
): number {
  if (planId === "custom") return custom ?? 1_000_000;
  return plans.find((p) => p.id === planId)?.tokens ?? plans[0].tokens;
}
