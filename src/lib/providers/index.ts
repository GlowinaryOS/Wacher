import "server-only";

import { getConfig } from "@/lib/config/env";
import { MockAnalysisProvider } from "./analysis/mock";
import { NoAnalysisProvider, type AnalysisProvider } from "./analysis/types";
import { MockMarketDataProvider } from "./market-data/mock";
import { NoMarketDataProvider } from "./market-data/none";
import type { MarketDataProvider } from "./market-data/types";
import { NoNewsProvider, type NewsProvider } from "./news/types";
import { NoSentimentProvider, type SentimentProvider } from "./sentiment/types";

/**
 * Provider registry. The rest of the application depends only on the
 * interfaces; adding a real provider means adding a case here.
 */
export interface Providers {
  marketData: MarketDataProvider;
  news: NewsProvider;
  sentiment: SentimentProvider;
  analysis: AnalysisProvider;
}

let cached: Providers | null = null;

export function getProviders(): Providers {
  if (cached) return cached;
  const cfg = getConfig();

  const marketData: MarketDataProvider =
    cfg.marketDataProvider === "mock" ? new MockMarketDataProvider() : new NoMarketDataProvider();

  const analysis: AnalysisProvider =
    cfg.analysisProvider === "mock" ? new MockAnalysisProvider() : new NoAnalysisProvider();

  cached = { marketData, news: new NoNewsProvider(), sentiment: new NoSentimentProvider(), analysis };
  return cached;
}
