import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MobileSidebarProvider } from "@/components/layout/mobile-sidebar-context";
import { LayoutContent } from "@/components/layout/layout-content";
import { summarizeSystemState } from "@/lib/agents/detect";
import { getProvider } from "@/lib/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agentic OS",
  description: "Unified dashboard for your AI agents, repos and knowledge base.",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=5.0",
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`} data-accent="iris" data-density="cozy">
      <body className="h-screen overflow-hidden">
        <MobileSidebarProvider>
          <LayoutContent agentStatuses={agentStatuses} notifications={notifications} systemState={systemState}>
            {children}
          </LayoutContent>
        </MobileSidebarProvider>
      </body>
    </html>
  );
}
