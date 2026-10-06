import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, biasTone, decisionTone, Empty, MockBadge, Notice, PageHeader, Panel, Skeleton, Stat } from "@/components/ui/primitives";
import { fmtPct, fmtPrice, fmtTime } from "@/lib/format";
import { getRepository } from "@/lib/repositories";
import { getMarketRegimes, getProviderState, researchAsset, type AssetResearch } from "@/lib/services/research";

function BucketList({ items, empty }: { items: AssetResearch[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-border">
      {items.map((r) => (
        <li key={r.asset.id} className="py-2 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/asset/${encodeURIComponent(r.asset.symbol)}`} className="num font-semibold text-accent hover:underline">
              {r.asset.symbol}
            </Link>
            <div className="flex gap-1">
              {r.analysis?.setup && <Badge tone={biasTone(r.analysis.setup.direction)}>{r.analysis.setup.direction}</Badge>}
              {r.technicals && (
                <Badge tone={biasTone(r.technicals.alignment)}>{r.technicals.conflict ? "TF conflict" : r.technicals.alignment}</Badge>
              )}
            </div>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.analysis?.decisionReason ?? "No analysis available."}</p>
        </li>
      ))}
    </ul>
  );
}

async function DashboardContent() {
  await connection();
  const repo = getRepository();
  const [assets, risk] = await Promise.all([repo.listAssets(), repo.getRiskSettings()]);
  const providers = getProviderState();
  const regimes = getMarketRegimes();
  const active = assets.filter((a) => a.active);
  const research = await Promise.all(active.map((a) => researchAsset(a, risk)));

  const trade = research.filter((r) => r.analysis?.decision === "TRADE");
  const watch = research.filter((r) => r.analysis?.decision === "WATCH");
  const noTrade = research.filter((r) => !r.analysis || r.analysis.decision === "NO_TRADE");
  const anyMock = providers.marketData.isMock || providers.analysis.isMock;

  return (
    <div className="space-y-4">
      {anyMock && (
        <Notice tone="mock" title="Development mode — synthetic data, mock analysis">
          No real market-data or Claude provider is configured. Everything marked MOCK is a placeholder generated from
          synthetic candles and must not be used for decisions. See Settings → Providers.
        </Notice>
      )}

      <Panel title="Market regime" subtitle="Assessed before individual assets">
        <div className="grid gap-3 md:grid-cols-2">
          {regimes.map((g) => (
            <div key={g.market} className="rounded-md border border-border bg-panel-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{g.market}</span>
                <Badge tone={biasTone(g.classification)}>{g.classification}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted">{g.reasoning}</p>
              <p className="mt-1 text-[11px] text-faint">Missing: {g.missingData.join(", ")}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Top setups" right={<>{anyMock && <MockBadge />}<Badge tone="accent">{trade.length}</Badge></>}>
          <BucketList items={trade} empty="No setup meets the evidence and risk criteria. NO TRADE is a valid result." />
        </Panel>
        <Panel title="Watch" right={<>{anyMock && <MockBadge />}<Badge tone="neutral">{watch.length}</Badge></>}>
          <BucketList items={watch} empty="Nothing on watch." />
        </Panel>
        <Panel title="No trade / avoid" right={<>{anyMock && <MockBadge />}<Badge>{noTrade.length}</Badge></>}>
          <BucketList items={noTrade} empty="—" />
        </Panel>
      </div>

      <Panel
        title="Watchlist"
        subtitle={`${active.length} active of ${assets.length}`}
        right={
          <Link href="/watchlist" className="text-xs text-accent hover:underline">
            Manage
          </Link>
        }
      >
        {active.length === 0 ? (
          <Empty>
            No active assets. <Link href="/watchlist" className="text-accent hover:underline">Add some to your watchlist.</Link>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] tracking-[0.12em] text-faint uppercase">
                  <th className="pr-3 pb-2 font-semibold">Asset</th>
                  <th className="pr-3 pb-2 text-right font-semibold">
                    Price {providers.marketData.isMock && <span className="text-mock normal-case">(synthetic)</span>}
                  </th>
                  <th className="pr-3 pb-2 text-right font-semibold">24h</th>
                  <th className="hidden pr-3 pb-2 font-semibold sm:table-cell">Timeframes</th>
                  <th className="pr-3 pb-2 font-semibold">Decision</th>
                  <th className="hidden pb-2 font-semibold md:table-cell">Data as of</th>
                </tr>
              </thead>
              <tbody>
                {research.map((r) => (
                  <tr key={r.asset.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <Link href={`/asset/${encodeURIComponent(r.asset.symbol)}`} className="num font-semibold text-accent hover:underline">
                        {r.asset.symbol}
                      </Link>
                      <span className="ml-2 hidden text-xs text-muted sm:inline">{r.asset.name}</span>
                    </td>
                    <td className="num py-2 pr-3 text-right">{fmtPrice(r.quote?.price)}</td>
                    <td
                      className={`num py-2 pr-3 text-right ${
                        (r.quote?.change24hPct ?? 0) > 0 ? "text-bull" : (r.quote?.change24hPct ?? 0) < 0 ? "text-bear" : "text-muted"
                      }`}
                    >
                      {fmtPct(r.quote?.change24hPct)}
                    </td>
                    <td className="hidden py-2 pr-3 sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {r.technicals?.timeframes.map((t) => (
                          <Badge key={t.timeframe} tone={biasTone(t.bias)} title={`${t.timeframe}: ${t.bias}`}>
                            {t.timeframe}
                          </Badge>
                        )) ?? <span className="text-xs text-faint">—</span>}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {r.analysis ? (
                        <Badge tone={decisionTone(r.analysis.decision)}>{r.analysis.decision.replace("_", " ")}</Badge>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                    </td>
                    <td className="hidden py-2 text-xs text-faint md:table-cell">{fmtTime(r.quote?.asOf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Open predictions" right={<Badge>Phase 3</Badge>}>
          <Stat label="Recorded" value="0" hint="The immutable prediction ledger is built in Phase 3." />
        </Panel>
        <Panel title="Recent results" right={<Badge>Phase 3</Badge>}>
          <Empty>No predictions have been resolved yet.</Empty>
        </Panel>
        <Panel title="Prediction accuracy">
          <Badge tone="warn">Insufficient sample size</Badge>
          <p className="mt-2 text-xs text-faint">0 resolved predictions. Accuracy is not reported below 20, and no edge is claimed without a large forward-tested sample.</p>
        </Panel>
        <Panel title="Paper trading" right={<Badge>Phase 4</Badge>}>
          <Empty>No paper trades. Paper trades are hypothetical and never placed with a broker.</Empty>
        </Panel>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Evidence before opinion. Risk before prediction. NO TRADE is a valid result."
        right={
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md border border-border bg-panel-2 px-4 py-2 text-sm font-semibold tracking-wide text-faint"
              title="Daily Watch needs a real market-data provider and the Claude analysis engine (Phase 2)."
            >
              RUN DAILY WATCH
            </button>
            <span className="text-[11px] text-faint">Available in Phase 2 (needs real data + Claude)</span>
          </div>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
            <Skeleton className="h-72" />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </>
  );
}
