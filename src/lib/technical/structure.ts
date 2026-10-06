import type {
  Bias,
  Candle,
  StructureLabel,
  TechnicalSummary,
  Timeframe,
  TimeframeTechnicals,
} from "@/lib/domain/types";
import { atr, ema, last, macd, rsi, sma } from "./indicators";

export interface SwingPoint {
  index: number;
  price: number;
}

/**
 * Pivot detection: a swing high is a candle whose high is strictly greater
 * than the highs of `lookback` candles on each side (mirror for lows).
 */
export function findSwings(candles: Candle[], lookback = 3): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push({ index: i, price: candles[i].high });
    if (isLow) lows.push({ index: i, price: candles[i].low });
  }
  return { highs, lows };
}

/** Classify structure from the last two swing highs and lows. */
export function classifyStructure(highs: SwingPoint[], lows: SwingPoint[], atrValue: number | null): StructureLabel {
  if (highs.length < 2 || lows.length < 2) return "INSUFFICIENT_DATA";
  const [h1, h2] = highs.slice(-2).map((p) => p.price);
  const [l1, l2] = lows.slice(-2).map((p) => p.price);
  // Treat moves smaller than a quarter ATR as "equal" to avoid labelling noise as structure.
  const tol = atrValue ? atrValue * 0.25 : 0;
  const hh = h2 > h1 + tol;
  const lh = h2 < h1 - tol;
  const hl = l2 > l1 + tol;
  const ll = l2 < l1 - tol;
  if (hh && hl) return "HH_HL";
  if (lh && ll) return "LH_LL";
  if (!hh && !lh && !hl && !ll) return "RANGE";
  return "MIXED";
}

export function analyseTimeframe(timeframe: Timeframe, candles: Candle[]): TimeframeTechnicals {
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1] ?? NaN;
  const atr14 = last(atr(candles, 14));
  const { highs, lows } = findSwings(candles, timeframe === "1W" ? 2 : 3);
  const structure = classifyStructure(highs, lows, atr14);

  const sma20 = last(sma(closes, 20));
  const sma50 = last(sma(closes, 50));
  const sma200 = closes.length >= 200 ? last(sma(closes, 200)) : null;
  const ema21 = last(ema(closes, 21));
  const rsi14 = last(rsi(closes, 14));
  const macdLast = last(macd(closes));

  const volumes = candles.map((c) => c.volume);
  const vAvg = last(sma(volumes, 20));
  const volumeVsAvg20 = vAvg && vAvg > 0 ? volumes[volumes.length - 1] / vAvg : null;

  // Slope of the 50-period SMA over the last 10 bars, normalised by ATR.
  const sma50Series = sma(closes, 50);
  const prevSma50 = sma50Series[sma50Series.length - 11] ?? null;
  const slope = sma50 !== null && prevSma50 !== null && atr14 ? (sma50 - prevSma50) / atr14 : null;

  let trend: TimeframeTechnicals["trend"] = "SIDEWAYS";
  if (sma50 !== null && slope !== null) {
    if (lastClose > sma50 && slope > 0.3) trend = "UP";
    else if (lastClose < sma50 && slope < -0.3) trend = "DOWN";
  }

  // Bias requires structure AND trend to agree. Indicators alone never set it.
  let bias: Bias = "NEUTRAL";
  if (structure === "HH_HL" && trend !== "DOWN" && (sma50 === null || lastClose > sma50)) bias = "BULLISH";
  else if (structure === "LH_LL" && trend !== "UP" && (sma50 === null || lastClose < sma50)) bias = "BEARISH";
  else if (structure === "MIXED") {
    // Mixed swings: lean with a clear moving-average trend, otherwise stay neutral.
    if (trend === "UP") bias = "BULLISH";
    if (trend === "DOWN") bias = "BEARISH";
  }

  const supportCandidates = lows.map((l) => l.price).filter((p) => p < lastClose);
  const resistanceCandidates = highs.map((h) => h.price).filter((p) => p > lastClose);
  const support = supportCandidates.length ? Math.max(...supportCandidates.slice(-6)) : null;
  const resistance = resistanceCandidates.length ? Math.min(...resistanceCandidates.slice(-6)) : null;

  const notes: string[] = [];
  if (rsi14 !== null && rsi14 >= 70) notes.push("RSI overbought (≥70) — context, not a sell signal");
  if (rsi14 !== null && rsi14 <= 30) notes.push("RSI oversold (≤30) — context, not a buy signal");
  if (macdLast && Math.sign(macdLast.histogram) !== Math.sign(macdLast.macd))
    notes.push("MACD histogram diverging from MACD line — momentum changing");
  if (volumeVsAvg20 !== null && volumeVsAvg20 > 1.8) notes.push("Volume well above 20-period average");
  if (sma200 === null) notes.push("Not enough history for 200-period SMA");
  if (structure === "INSUFFICIENT_DATA") notes.push("Not enough swing points to classify structure");

  return {
    timeframe,
    lastClose,
    structure,
    trend,
    bias,
    sma20,
    sma50,
    sma200,
    ema21,
    rsi14,
    macd: macdLast,
    atr14,
    atrPct: atr14 && lastClose ? (atr14 / lastClose) * 100 : null,
    volumeVsAvg20,
    swingHighs: highs.slice(-5).map((h) => h.price),
    swingLows: lows.slice(-5).map((l) => l.price),
    support,
    resistance,
    notes,
  };
}

/** Combine per-timeframe results. Opposing biases are flagged as a conflict, never averaged away. */
export function summarise(timeframes: TimeframeTechnicals[]): TechnicalSummary {
  const biases = timeframes.map((t) => t.bias);
  const hasBull = biases.includes("BULLISH");
  const hasBear = biases.includes("BEARISH");
  const conflict = hasBull && hasBear;

  let alignment: TechnicalSummary["alignment"] = "NEUTRAL";
  if (conflict) alignment = "CONFLICT";
  else if (biases.length && biases.every((b) => b === "BULLISH")) alignment = "BULLISH";
  else if (biases.length && biases.every((b) => b === "BEARISH")) alignment = "BEARISH";

  const keyLevels: TechnicalSummary["keyLevels"] = [];
  for (const t of timeframes) {
    if (t.timeframe !== "1D" && t.timeframe !== "4H" && t.timeframe !== "1W") continue;
    if (t.resistance !== null) keyLevels.push({ label: `${t.timeframe} resistance`, price: t.resistance });
    if (t.support !== null) keyLevels.push({ label: `${t.timeframe} support`, price: t.support });
  }
  keyLevels.sort((a, b) => b.price - a.price);

  return { timeframes, conflict, alignment, keyLevels };
}
