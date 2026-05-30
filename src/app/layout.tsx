import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { summarizeSystemState } from "@/lib/agents/detect";
import { getProvider } from "@/lib/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agentic OS",
  description: "Unified dashboard for your AI agents, repos and knowledge base.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const provider = getProvider();
  const [notifications, agents] = await Promise.all([
    provider.listActivity(),
    provider.listAgents(),
  ]);
  const agentStatuses = Object.fromEntries(
    agents.map((s) => [s.id, s.status]),
  ) as Record<string, "online" | "offline" | "running" | "degraded">;
  const systemState = summarizeSystemState(agents);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="h-screen overflow-hidden">
        <div className="grid h-screen" style={{ gridTemplateColumns: "auto 1fr" }}>
          <Sidebar agentStatuses={agentStatuses} />
          <div className="flex min-w-0 flex-col" style={{ height: "100vh" }}>
            <TopBar
              notifications={notifications}
              systemState={systemState.state}
              systemLabel={systemState.label}
            />
            <main className="flex-1 overflow-y-auto px-8 py-7 pb-14">
              <div className="mx-auto max-w-[1320px]">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
