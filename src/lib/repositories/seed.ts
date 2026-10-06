import type { AssetInput } from "@/lib/domain/types";

/**
 * Example starting watchlist, written to a NEW local store only once.
 * It is ordinary user data: edit or delete any of it from the Watchlist page.
 * TradingView symbols should be checked by the user — exchanges list
 * different pairs.
 */
export const EXAMPLE_WATCHLIST: AssetInput[] = [
  { symbol: "BTC", name: "Bitcoin", assetType: "CRYPTO", exchange: "COINBASE", currency: "USD", tradingViewSymbol: "COINBASE:BTCUSD", notes: "", active: true },
  { symbol: "ETH", name: "Ethereum", assetType: "CRYPTO", exchange: "COINBASE", currency: "USD", tradingViewSymbol: "COINBASE:ETHUSD", notes: "", active: true },
  { symbol: "ZEC", name: "Zcash", assetType: "CRYPTO", exchange: "COINBASE", currency: "USD", tradingViewSymbol: "COINBASE:ZECUSD", notes: "", active: true },
  { symbol: "AAVE", name: "Aave", assetType: "CRYPTO", exchange: "COINBASE", currency: "USD", tradingViewSymbol: "COINBASE:AAVEUSD", notes: "", active: true },
  { symbol: "RPL", name: "Rocket Pool", assetType: "CRYPTO", exchange: "BINANCE", currency: "USDT", tradingViewSymbol: "BINANCE:RPLUSDT", notes: "Check which exchange you actually trade RPL on and update the symbol.", active: true },
  { symbol: "YFI", name: "yearn.finance", assetType: "CRYPTO", exchange: "COINBASE", currency: "USD", tradingViewSymbol: "COINBASE:YFIUSD", notes: "", active: true },
  { symbol: "NVDA", name: "NVIDIA", assetType: "STOCK", exchange: "NASDAQ", currency: "USD", tradingViewSymbol: "NASDAQ:NVDA", notes: "", active: true },
  { symbol: "TSLA", name: "Tesla", assetType: "STOCK", exchange: "NASDAQ", currency: "USD", tradingViewSymbol: "NASDAQ:TSLA", notes: "", active: true },
  { symbol: "MSFT", name: "Microsoft", assetType: "STOCK", exchange: "NASDAQ", currency: "USD", tradingViewSymbol: "NASDAQ:MSFT", notes: "", active: true },
  { symbol: "META", name: "Meta Platforms", assetType: "STOCK", exchange: "NASDAQ", currency: "USD", tradingViewSymbol: "NASDAQ:META", notes: "", active: true },
];
