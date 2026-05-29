import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const source = process.env.DATA_SOURCE ?? "mock";

  return (
    <>
      <PageHeader title="Settings" subtitle="Data sources, integrations and appearance." icon="Settings" />

      <div className="max-w-3xl space-y-6">
        {/* Data source — the mock <-> live switch */}
        <Card>
          <CardHeader>
            <CardTitle>Data Source</CardTitle>
            <Badge tone={source === "live" ? "ok" : "info"}>{source}</Badge>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-sm text-muted">
              The dashboard reads everything through a single provider. Switch the{" "}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-[var(--accent)]">DATA_SOURCE</code>{" "}
              environment variable to move from demo data to your real sources.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { id: "mock", title: "Mock", desc: "Static demo fixtures. No I/O. Current prototype mode." },
                { id: "live", title: "Live", desc: "Real sources on your host: GitHub, vault, ~/.claude, ~/.codex, ~/.hermes." },
              ].map((opt) => {
                const active = opt.id === source;
                return (
                  <div
                    key={opt.id}
                    className={cn(
                      "rounded-xl border p-4",
                      active ? "border-[var(--accent-line)] bg-[var(--accent-soft)]" : "border-line bg-surface-2",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{opt.title}</span>
                      {active && <Icon name="CircleCheck" size={16} className="text-[var(--accent)]" />}
                    </div>
                    <p className="mt-1 text-xs text-faint">{opt.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <ul className="divide-y divide-line">
              {[
                { icon: "Github", name: "GitHub", detail: "Repositories source", on: true },
                { icon: "Hexagon", name: "Obsidian Vault", detail: "Knowledge base", on: true },
                { icon: "Plug", name: "MCP Servers", detail: "8 connected", on: true },
              ].map((it) => (
                <li key={it.name} className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-muted">
                      <Icon name={it.icon} size={16} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-ink">{it.name}</span>
                      <span className="block text-xs text-faint">{it.detail}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-ok">
                    <span className="size-1.5 rounded-full bg-ok" /> Connected
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
