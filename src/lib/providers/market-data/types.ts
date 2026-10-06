import type { CandleSeries, Quote, Timeframe, WatchlistAsset } from "@/lib/domain/types";

/**
 * Machine-readable market data. TradingView widgets are visual only and are
 * never a source for this interface.
 */
export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  readonly isMock: boolean;
  readonly configured: boolean;
  getQuote(asset: WatchlistAsset): Promise<Quote | null>;
  getCandles(asset: WatchlistAsset, timeframe: Timeframe, limit?: number): Promise<CandleSeries | null>;
}
