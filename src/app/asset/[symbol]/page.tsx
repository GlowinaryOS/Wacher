import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  AnalysisPanel,
  MarketStructurePanel,
  NewsPanel,
  ProviderQuote,
  ScenariosPanel,
  SelfChallengePanel,
  SentimentPanel,
  TimeframePanel,
  TradePlanPanel,
} from "@/components/asset/AssetSections";
import { TradingViewAdvancedChart, TradingViewSymbolInfo } from "@/components/tradingview/TradingViewCharts";
import { Badge, Empty, MockBadge, Notice, Panel, Skeleton } from "@/components/ui/primitives";
import { resolveTradingViewSymbol } from "@/lib/providers/tradingview/symbols";
import { getRepository } from "@/lib/repositories";
import { getProviderState, researchAsset } from "@/lib/services/research";

export async function generateMetadata({ params }: PageProps<"/asset/[symbol]">) {
  const { symbol } = await params;
  return { title: decodeURIComponent(symbol).toUpperCase() };
}

async function AssetContent({ params }: { params: PageProps<"/asset/[symbol]">["params"] }) {
  await connection();
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const repo = getRepository();
  const asset = await repo.getAssetBySymbol(symbol);
  if (!asset) notFound();

  const [risk, providers] = await Promise.all([repo.getRiskSettings(), Promise.resolve(getProviderState())]);
  const research = await researchAsset(asset, risk);
  const tvSymbol = resolveTradingViewSymbol(asset);
  const anyMock = providers.marketData.isMock || providers.analysis.isMock;

  return (
    <div className="space-y-4">
      {/* Asset header */}
      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-text">{asset.name}</h1>
              <span className="num text-sm text-muted">{asset.symbol}</span>
              <Badge>{asset.assetType}</Badge>
              <Badge>{asset.exchange}</Badge>
              {!asset.active && <Badge tone="warn">Disabled</Badge>}
            </div>
            {asset.notes && <p className="mt-1 max-w-2xl text-sm text-muted">{asset.notes}</p>}
            <div className="mt-3">
              <ProviderQuote quote={research.quote} currency={asset.currency} providers={providers} />
            </div>
          </div>
          <div className="w-full max-w-sm">
            <div className="text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">Via TradingView (visual only)</div>
            <TradingViewSymbolInfo symbol={tvSymbol} />
          </div>
        </div>
      </section>

      {anyMock && (
        <Notice tone="mock" title="Development mode: synthetic data and mock analysis">
          Prices, technicals, scenarios and setups below are generated from SYNTHETIC candles by a rule-based placeholder,
          not Claude, and do not describe the real market. The TradingView chart shows real market data and will not match.
          Configure real providers before relying on anything here.
        </Notice>
      )}
      {research.errors.length > 0 && (
        <Notice tone="bear" title="Some data could not be loaded">
          {research.errors.join(" · ")}
        </Notice>
      )}

      {/* TradingView chart */}
      <Panel title="Chart" subtitle="Official TradingView Advanced Chart widget">
        <TradingViewAdvancedChart symbol={tvSymbol} />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <AnalysisPanel analysis={research.analysis} providerLabel={providers.analysis.label} />
          <ScenariosPanel analysis={research.analysis} />
          <SelfChallengePanel analysis={research.analysis} />
          <TradePlanPanel analysis={research.analysis} sizing={research.sizing} risk={risk} currency={asset.currency} />
        </div>
        <div className="min-w-0 space-y-4">
          <MarketStructurePanel technicals={research.technicals} isMock={providers.marketData.isMock} />
          <TimeframePanel technicals={research.technicals} />
          <NewsPanel items={research.news} providerLabel={providers.news.label} configured={providers.news.configured} />
          <SentimentPanel
            items={research.sentiment}
            providerLabel={providers.sentiment.label}
            configured={providers.sentiment.configured}
          />
          <Panel title="Historical predictions" right={<Badge>Phase 3</Badge>}>
            <Empty>
              The prediction ledger arrives in Phase 3. Every prediction for {asset.symbol} will be listed here with its
              locked original thesis and its evaluated outcome.
            </Empty>
          </Panel>
          {research.missingData.length > 0 && (
            <Panel title="Missing data">
              <div className="flex flex-wrap gap-1">
                {research.missingData.map((m) => (
                  <Badge key={m}>{m}</Badge>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
      {research.analysis?.meta.isMock && (
        <p className="text-center text-[11px] text-faint">
          <MockBadge /> Everything marked mock is a development placeholder.
        </p>
      )}
    </div>
  );
}

export default function AssetPage({ params }: PageProps<"/asset/[symbol]">) {
  return (
    <>
      <nav className="mb-3 text-xs text-faint">
        <Link href="/" className="hover:text-text">
          Dashboard
        </Link>{" "}
        /{" "}
        <Link href="/watchlist" className="hover:text-text">
          Watchlist
        </Link>
      </nav>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-36" />
            <Skeleton className="h-[560px]" />
          </div>
        }
      >
        <AssetContent params={params} />
      </Suspense>
    </>
  );
}
