import "server-only";

import type {
  Analysis,
  AssetType,
  MarketRegime,
  NewsItem,
  Quote,
  RiskSettings,
  SentimentItem,
  TechnicalSummary,
  Timeframe,
  WatchlistAsset,
} from "@/lib/domain/types";
import { getProviders } from "@/lib/providers";
import { sizePosition, type SizingResult } from "@/lib/risk/position-sizing";
import { analyseTimeframe, summarise } from "@/lib/technical/structure";

/**
 * Timeframes analysed per asset class. Crypto trades 24/7 so 4H candles are
 * meaningful; stock/ETF 4H candles straddle sessions, so they use 1W/1D/1H.
 */
export const ANALYSIS_TIMEFRAMES: Record<AssetType, Timeframe[]> = {
  CRYPTO: ["1W", "1D", "4H", "1H"],
  STOCK: ["1W", "1D", "1H"],
  ETF: ["1W", "1D", "1H"],
};

export interface ProviderState {
  marketData: { id: string; label: string; isMock: boolean; configured: boolean };
  news: { id: string; label: string; configured: boolean };
  sentiment: { id: string; label: string; configured: boolean };
  analysis: { id: string; label: string; isMock: boolean; configured: boolean };
}

export interface AssetResearch {
  asset: WatchlistAsset;
  quote: Quote | null;
  technicals: TechnicalSummary | null;
  news: NewsItem[];
  sentiment: SentimentItem[];
  analysis: Analysis | null;
  sizing: SizingResult | null;
  missingData: string[];
  errors: string[];
}

export function getProviderState(): ProviderState {
  const p = getProviders();
  return {
    marketData: { id: p.marketData.id, label: p.marketData.label, isMock: p.marketData.isMock, configured: p.marketData.configured },
    news: { id: p.news.id, label: p.news.label, configured: p.news.configured },
    sentiment: { id: p.sentiment.id, label: p.sentiment.label, configured: p.sentiment.configured },
    analysis: { id: p.analysis.id, label: p.analysis.label, isMock: p.analysis.isMock, configured: p.analysis.configured },
  };
}

/**
 * Market regime. Phase 1 never infers a regime: synthetic data says nothing
 * about the real market, and no real benchmark provider exists yet.
 */
export function getMarketRegimes(): MarketRegime[] {
  const p = getProviders();
  const reason = !p.marketData.configured
    ? "No market-data provider is configured, so benchmark data (indexes, volatility, yields, dollar, BTC/ETH trend, dominance) is unavailable."
    : p.marketData.isMock
      ? "Only synthetic mock data is available. A regime must not be inferred from synthetic data."
      : "Regime classification is implemented in Phase 2.";
  const asOf = new Date().toISOString();
  return [
    {
      market: "STOCKS",
      classification: "UNCLEAR",
      reasoning: reason,
      missingData: ["S&P 500 / Nasdaq trend", "VIX", "US 10Y yield", "DXY", "Sector strength", "Macro calendar"],
      asOf,
    },
    {
      market: "CRYPTO",
      classification: "UNCLEAR",
      reasoning: reason,
      missingData: ["BTC trend", "ETH trend", "Total market cap", "BTC dominance", "Crypto event calendar"],
      asOf,
    },
  ];
}

export async function researchAsset(asset: WatchlistAsset, riskSettings: RiskSettings): Promise<AssetResearch> {
  const p = getProviders();
  const errors: string[] = [];
  const missingData: string[] = [];
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message}`);
      return fallback;
    }
  };

  const timeframes = ANALYSIS_TIMEFRAMES[asset.assetType];
  const [quote, seriesList, news, sentiment] = await Promise.all([
    safe("Quote", () => p.marketData.getQuote(asset), null),
    Promise.all(timeframes.map((tf) => safe(`Candles ${tf}`, () => p.marketData.getCandles(asset, tf, 300), null))),
    safe("News", () => p.news.getNews(asset), []),
    safe("Sentiment", () => p.sentiment.getSentiment(asset), []),
  ]);

  if (!quote) missingData.push("Current quote");
  const analysed = seriesList.flatMap((s, i) => {
    if (!s || s.candles.length < 30) {
      missingData.push(`${timeframes[i]} candles`);
      return [];
    }
    return [analyseTimeframe(timeframes[i], s.candles)];
  });
  const technicals = analysed.length ? summarise(analysed) : null;
  if (!p.news.configured) missingData.push("News (no provider)");
  if (!p.sentiment.configured) missingData.push("Sentiment (no provider)");

  let analysis: Analysis | null = null;
  if (quote && technicals) {
    analysis = await safe(
      "Analysis",
      () =>
        p.analysis.analyse({
          asset: { symbol: asset.symbol, name: asset.name, assetType: asset.assetType, exchange: asset.exchange, currency: asset.currency },
          dataTimestamp: quote.asOf,
          quote,
          technicals,
          marketRegime: null,
          news,
          sentiment,
          riskRules: riskSettings,
          previousAnalysis: null,
          missingData,
        }),
      null,
    );
  }

  let sizing: SizingResult | null = null;
  if (analysis?.setup) {
    const s = analysis.setup;
    sizing = sizePosition(
      { direction: s.direction, entry: (s.entryLow + s.entryHigh) / 2, stop: s.stop, target1: s.target1, target2: s.target2 },
      riskSettings,
    );
  }

  return { asset, quote, technicals, news, sentiment, analysis, sizing, missingData, errors };
}
