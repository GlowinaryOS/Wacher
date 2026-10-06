import { describe, expect, it } from "vitest";
import type { Candle } from "@/lib/domain/types";
import { analyseTimeframe, classifyStructure, findSwings, summarise } from "./structure";

/** Build candles from a close path with fixed wicks. */
function candlesFrom(closes: number[]): Candle[] {
  return closes.map((c, i) => {
    const open = i === 0 ? c : (closes[i - 1] + c) / 2;
    return { time: 1_700_000_000_000 + i * 3_600_000, open, high: Math.max(open, c) + 0.2, low: Math.min(open, c) - 0.2, close: c, volume: 1000 };
  });
}

/** Zig-zag that steps up (or down) each leg. */
function zigzag(legs: number, step: number, legLen = 5, start = 100): number[] {
  const out: number[] = [start];
  let base = start;
  for (let l = 0; l < legs; l++) {
    const up = l % 2 === 0;
    const amp = up ? 4 + step : -4;
    for (let i = 1; i <= legLen; i++) out.push(base + (amp * i) / legLen);
    base += amp;
  }
  return out;
}

describe("findSwings / classifyStructure", () => {
  it("detects higher highs and higher lows in a stair-step uptrend", () => {
    const c = candlesFrom(zigzag(16, 2));
    const { highs, lows } = findSwings(c, 3);
    expect(highs.length).toBeGreaterThanOrEqual(2);
    expect(lows.length).toBeGreaterThanOrEqual(2);
    expect(classifyStructure(highs, lows, 1)).toBe("HH_HL");
  });

  it("detects lower highs and lower lows in a mirrored downtrend", () => {
    const up = zigzag(16, 2);
    const c = candlesFrom(up.map((v) => 300 - v));
    const { highs, lows } = findSwings(c, 3);
    expect(classifyStructure(highs, lows, 1)).toBe("LH_LL");
  });

  it("reports a range when swings repeat at the same levels", () => {
    const c = candlesFrom(zigzag(16, -0)); // up 4, down 4 → flat
    const { highs, lows } = findSwings(c, 3);
    expect(classifyStructure(highs, lows, 1)).toBe("RANGE");
  });

  it("refuses to classify without enough swings", () => {
    expect(classifyStructure([], [], null)).toBe("INSUFFICIENT_DATA");
  });
});

describe("analyseTimeframe", () => {
  it("gives a bullish bias to a sustained stair-step uptrend", () => {
    const t = analyseTimeframe("1D", candlesFrom(zigzag(40, 2)));
    expect(t.structure).toBe("HH_HL");
    expect(t.trend).toBe("UP");
    expect(t.bias).toBe("BULLISH");
    expect(t.support).not.toBeNull();
    expect(t.support!).toBeLessThan(t.lastClose);
  });

  it("notes overbought RSI as context rather than a signal", () => {
    const t = analyseTimeframe("1D", candlesFrom(Array.from({ length: 80 }, (_, i) => 100 + i)));
    expect(t.rsi14).toBeGreaterThan(70);
    expect(t.notes.join(" ")).toMatch(/not a sell signal/);
  });
});

describe("summarise", () => {
  const base = analyseTimeframe("1D", candlesFrom(zigzag(40, 2)));
  it("flags TIMEFRAMES CONFLICT when biases oppose", () => {
    const s = summarise([
      { ...base, timeframe: "1D", bias: "BULLISH" },
      { ...base, timeframe: "4H", bias: "NEUTRAL" },
      { ...base, timeframe: "1H", bias: "BEARISH" },
    ]);
    expect(s.conflict).toBe(true);
    expect(s.alignment).toBe("CONFLICT");
  });
  it("only reports alignment when every timeframe agrees", () => {
    expect(summarise([{ ...base, bias: "BULLISH" }, { ...base, timeframe: "4H", bias: "BULLISH" }]).alignment).toBe("BULLISH");
    expect(summarise([{ ...base, bias: "BULLISH" }, { ...base, timeframe: "4H", bias: "NEUTRAL" }]).alignment).toBe("NEUTRAL");
  });
});
