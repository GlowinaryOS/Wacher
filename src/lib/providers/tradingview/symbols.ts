import type { AssetType, Timeframe } from "@/lib/domain/types";

/**
 * Helpers for TradingView's official embeddable widgets. These only build
 * widget configuration — TradingView is the visual layer and Watcher never
 * reads data back from the embedded iframe.
 */

/** Default TradingView symbol when the user hasn't set one explicitly. */
export function defaultTradingViewSymbol(symbol: string, exchange: string, assetType: AssetType, currency: string): string {
  const s = symbol.toUpperCase();
  const ex = exchange.toUpperCase();
  if (assetType === "CRYPTO") {
    // Crypto pairs on TradingView are "<EXCHANGE>:<BASE><QUOTE>", e.g. COINBASE:BTCUSD.
    return `${ex}:${s}${currency.toUpperCase()}`;
  }
  return `${ex}:${s}`;
}

export function resolveTradingViewSymbol(asset: {
  symbol: string;
  exchange: string;
  assetType: AssetType;
  currency: string;
  tradingViewSymbol: string;
}): string {
  return asset.tradingViewSymbol?.trim()
    ? asset.tradingViewSymbol.trim().toUpperCase()
    : defaultTradingViewSymbol(asset.symbol, asset.exchange, asset.assetType, asset.currency);
}

/** TradingView widget interval codes. */
export const TV_INTERVALS: Record<Timeframe, string> = {
  "15M": "15",
  "1H": "60",
  "4H": "240",
  "1D": "D",
  "1W": "W",
};

export function isTimeframe(v: string | undefined): v is Timeframe {
  return v === "15M" || v === "1H" || v === "4H" || v === "1D" || v === "1W";
}
