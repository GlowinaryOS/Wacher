import type { Candle, CandleSeries, Quote, Timeframe, WatchlistAsset } from "@/lib/domain/types";
import type { MarketDataProvider } from "./types";

/**
 * SYNTHETIC market data for development only.
 *
 * Candles are a deterministic, seeded random walk per symbol. The price
 * level is derived from a hash of the symbol and is deliberately NOT the
 * real price of the instrument. Never use this provider for decisions.
 */

const HOUR = 3_600_000;
const ORIGIN = Date.UTC(2025, 0, 1); // fixed origin keeps the series stable between requests

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function generateHourlyCandles(seedKey: string, assetType: WatchlistAsset["assetType"], now: number): Candle[] {
  const rand = mulberry32(hashString(seedKey));
  const end = Math.floor(now / HOUR) * HOUR;
  const count = Math.floor((end - ORIGIN) / HOUR);
  const baseVol = assetType === "CRYPTO" ? 0.009 : 0.005;

  let price = 20 + (hashString(seedKey + ":level") % 980); // 20..1000, intentionally unrealistic
  let drift = 0;
  let vol = baseVol;
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 240 === 0) {
      drift = (rand() - 0.5) * 0.0012;
      vol = baseVol * (0.6 + rand() * 0.9);
    }
    const open = price;
    const ret = drift + vol * gaussian(rand);
    const close = Math.max(0.01, open * Math.exp(ret));
    const wick = vol * open * 0.6;
    const high = Math.max(open, close) + Math.abs(gaussian(rand)) * wick;
    const low = Math.max(0.005, Math.min(open, close) - Math.abs(gaussian(rand)) * wick);
    const volume = Math.round((1000 + rand() * 4000) * (1 + Math.abs(ret) * 80));
    out.push({ time: ORIGIN + i * HOUR, open, high, low, close, volume });
    price = close;
  }
  return out;
}

const BUCKET_HOURS: Record<Exclude<Timeframe, "15M">, number> = { "1H": 1, "4H": 4, "1D": 24, "1W": 168 };

export function aggregate(hourly: Candle[], hours: number): Candle[] {
  if (hours === 1) return hourly;
  const bucketMs = hours * HOUR;
  // Weekly buckets start on Monday 00:00 UTC (epoch was a Thursday).
  const offset = hours === 168 ? 4 * 24 * HOUR : 0;
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let curKey = -1;
  for (const c of hourly) {
    const key = Math.floor((c.time - offset) / bucketMs);
    if (key !== curKey) {
      if (cur) out.push(cur);
      curKey = key;
      cur = { time: key * bucketMs + offset, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    } else if (cur) {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Split recent hourly candles into 15-minute candles that stay within each hour's range. */
function subdivide(hourly: Candle[], seedKey: string): Candle[] {
  const out: Candle[] = [];
  for (const h of hourly) {
    const rand = mulberry32(hashString(`${seedKey}:${h.time}`));
    let prev = h.open;
    for (let q = 0; q < 4; q++) {
      const target = q === 3 ? h.close : h.open + ((h.close - h.open) * (q + 1)) / 4 + (rand() - 0.5) * (h.high - h.low) * 0.4;
      const close = Math.min(h.high, Math.max(h.low, target));
      const hi = Math.min(h.high, Math.max(prev, close) + rand() * (h.high - Math.max(prev, close)));
      const lo = Math.max(h.low, Math.min(prev, close) - rand() * (Math.min(prev, close) - h.low));
      out.push({ time: h.time + q * 15 * 60_000, open: prev, high: hi, low: lo, close, volume: Math.round(h.volume / 4) });
      prev = close;
    }
  }
  return out;
}

export class MockMarketDataProvider implements MarketDataProvider {
  readonly id = "mock";
  readonly label = "Synthetic mock data (development only)";
  readonly isMock = true;
  readonly configured = true;

  private cache = new Map<string, Candle[]>();

  private hourly(asset: WatchlistAsset): Candle[] {
    const now = Date.now();
    const key = `${asset.assetType}:${asset.symbol}:${Math.floor(now / HOUR)}`;
    let series = this.cache.get(key);
    if (!series) {
      if (this.cache.size > 200) this.cache.clear();
      series = generateHourlyCandles(`${asset.assetType}:${asset.symbol}`, asset.assetType, now);
      this.cache.set(key, series);
    }
    return series;
  }

  async getQuote(asset: WatchlistAsset): Promise<Quote | null> {
    const h = this.hourly(asset);
    if (h.length < 25) return null;
    const last = h[h.length - 1];
    const prior = h[h.length - 25];
    return {
      symbol: asset.symbol,
      price: last.close,
      change24hPct: ((last.close - prior.close) / prior.close) * 100,
      marketStatus: asset.assetType === "CRYPTO" ? "24/7" : "UNKNOWN",
      provider: this.id,
      asOf: new Date(last.time + 3_600_000).toISOString(),
      isMock: true,
    };
  }

  async getCandles(asset: WatchlistAsset, timeframe: Timeframe, limit = 300): Promise<CandleSeries | null> {
    const h = this.hourly(asset);
    const candles =
      timeframe === "15M"
        ? subdivide(h.slice(-Math.ceil(limit / 4)), asset.symbol)
        : aggregate(h, BUCKET_HOURS[timeframe]);
    const sliced = candles.slice(-limit);
    if (sliced.length === 0) return null;
    return {
      symbol: asset.symbol,
      timeframe,
      candles: sliced,
      provider: this.id,
      asOf: new Date(h[h.length - 1].time + 3_600_000).toISOString(),
      isMock: true,
    };
  }
}
