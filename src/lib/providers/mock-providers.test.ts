import { describe, expect, it } from "vitest";
import { AnalysisSchema, CandleSchema, DEFAULT_RISK_SETTINGS, type WatchlistAsset } from "@/lib/domain/types";
import { analyseTimeframe, summarise } from "@/lib/technical/structure";
import { MockAnalysisProvider } from "./analysis/mock";
import { MockMarketDataProvider } from "./market-data/mock";

const asset = (symbol: string, assetType: WatchlistAsset["assetType"] = "CRYPTO"): WatchlistAsset => ({
  id: symbol, symbol, name: symbol, assetType, exchange: "TEST", currency: "USD", tradingViewSymbol: "",
  notes: "", active: true, createdAt: "", updatedAt: "",
});

describe("MockMarketDataProvider", () => {
  const p = new MockMarketDataProvider();

  it("labels everything as mock", async () => {
    const q = await p.getQuote(asset("BTC"));
    expect(q?.isMock).toBe(true);
    const s = await p.getCandles(asset("BTC"), "1D");
    expect(s?.isMock).toBe(true);
  });

  it("is deterministic per symbol and differs between symbols", async () => {
    const a1 = await p.getCandles(asset("AAA"), "1D", 50);
    const a2 = await new MockMarketDataProvider().getCandles(asset("AAA"), "1D", 50);
    const b = await p.getCandles(asset("BBB"), "1D", 50);
    expect(a1?.candles).toEqual(a2?.candles);
    expect(a1?.candles.at(-1)?.close).not.toEqual(b?.candles.at(-1)?.close);
  });

  it("produces valid, internally consistent candles on every timeframe", async () => {
    for (const tf of ["15M", "1H", "4H", "1D", "1W"] as const) {
      const s = await p.getCandles(asset("ETH"), tf, 120);
      expect(s, tf).not.toBeNull();
      for (const c of s!.candles) expect(CandleSchema.safeParse(c).success, `${tf} ${JSON.stringify(c)}`).toBe(true);
      const times = s!.candles.map((c) => c.time);
      expect([...times].sort((x, y) => x - y)).toEqual(times);
    }
  });
});

describe("MockAnalysisProvider", () => {
  it("returns schema-valid, mock-labelled analysis for many symbols", async () => {
    const md = new MockMarketDataProvider();
    const ap = new MockAnalysisProvider();
    const decisions = new Set<string>();
    for (const sym of ["BTC", "ETH", "ZEC", "AAVE", "RPL", "YFI", "NVDA", "TSLA", "MSFT", "META", "SOL", "XRP"]) {
      const a = asset(sym, sym.length === 4 && sym !== "AAVE" ? "STOCK" : "CRYPTO");
      const quote = (await md.getQuote(a))!;
      const tfs = a.assetType === "CRYPTO" ? (["1W", "1D", "4H", "1H"] as const) : (["1W", "1D", "1H"] as const);
      const t = [];
      for (const tf of tfs) t.push(analyseTimeframe(tf, (await md.getCandles(a, tf, 300))!.candles));
      const technicals = summarise(t);
      const out = await ap.analyse({
        asset: a, dataTimestamp: quote.asOf, quote, technicals, marketRegime: null, news: [], sentiment: [],
        riskRules: DEFAULT_RISK_SETTINGS, previousAnalysis: null, missingData: [],
      });
      expect(out).not.toBeNull();
      expect(out!.meta.isMock).toBe(true);
      expect(AnalysisSchema.safeParse(out).success).toBe(true);
      if (technicals.conflict) expect(out!.decision).toBe("NO_TRADE");
      if (out!.setup) {
        const s = out!.setup;
        if (s.direction === "LONG") expect(s.stop).toBeLessThan(s.entryLow);
        else expect(s.stop).toBeGreaterThan(s.entryHigh);
      }
      decisions.add(out!.decision);
    }
    expect(decisions.size).toBeGreaterThan(0);
  });
});
