import type { MarketDataProvider } from "./types";

/** Used when no market-data provider is configured. Returns nothing — never invents data. */
export class NoMarketDataProvider implements MarketDataProvider {
  readonly id = "none";
  readonly label = "Not configured";
  readonly isMock = false;
  readonly configured = false;

  async getQuote() {
    return null;
  }

  async getCandles() {
    return null;
  }
}
