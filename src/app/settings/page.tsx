import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RiskForm } from "@/components/settings/RiskForm";
import { Badge, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { getConfig } from "@/lib/config/env";
import { getRepository } from "@/lib/repositories";
import { getProviderState } from "@/lib/services/research";

export const metadata: Metadata = { title: "Settings" };

function Row({ name, value, status }: { name: string; value: string; status: "ok" | "mock" | "off" }) {
  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-3 text-sm text-text">{name}</td>
      <td className="py-2 pr-3 text-sm text-muted">{value}</td>
      <td className="py-2 text-right">
        {status === "ok" ? <Badge tone="bull">Configured</Badge> : status === "mock" ? <Badge tone="mock">Mock</Badge> : <Badge>Not configured</Badge>}
      </td>
    </tr>
  );
}

async function SettingsContent() {
  await connection();
  const repo = getRepository();
  const risk = await repo.getRiskSettings();
  const p = getProviderState();
  const cfg = getConfig();
  const st = (configured: boolean, isMock = false) => (isMock ? "mock" : configured ? "ok" : "off");

  return (
    <div className="space-y-4">
      <Panel title="Risk rules" subtitle="Your rules. Watcher checks hypothetical setups against them and warns on violations.">
        <RiskForm settings={risk} />
      </Panel>

      <Panel title="Providers" subtitle="Set via server-side environment variables (see .env.example). Keys never reach the browser.">
        <table className="w-full text-left">
          <tbody>
            <Row name="Market data" value={p.marketData.label} status={st(p.marketData.configured, p.marketData.isMock)} />
            <Row name="Analysis (reasoning layer)" value={p.analysis.label} status={st(p.analysis.configured, p.analysis.isMock)} />
            <Row name="News" value={p.news.label} status={st(p.news.configured)} />
            <Row name="Sentiment" value={p.sentiment.label} status={st(p.sentiment.configured)} />
            <Row name="TradingView" value="Official embedded widgets (visual only)" status="ok" />
            <Row
              name="Anthropic API key"
              value={cfg.anthropicConfigured ? "Present (used from Phase 2)" : "Not set"}
              status={cfg.anthropicConfigured ? "ok" : "off"}
            />
          </tbody>
        </table>
      </Panel>

      <Panel title="System">
        <table className="w-full text-left">
          <tbody>
            <Row
              name="Data backend"
              value={repo.backend === "supabase" ? "Supabase (PostgreSQL)" : `Local JSON store (${cfg.localDataDir}/watcher.json)`}
              status="ok"
            />
            <Row name="Access protection" value={cfg.basicAuthEnabled ? "HTTP Basic Auth enabled" : "None — keep this app private"} status={cfg.basicAuthEnabled ? "ok" : "off"} />
            <Row name="Broker connection" value="None, by design. Watcher never places trades." status="off" />
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
