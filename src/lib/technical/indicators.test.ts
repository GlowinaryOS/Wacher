import { describe, expect, it } from "vitest";
import { atr, ema, last, macd, rsi, sma } from "./indicators";

describe("sma", () => {
  it("averages a sliding window and leaves warm-up null", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
});

describe("ema", () => {
  it("seeds with the SMA then smooths", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBe(2);
    expect(out[3]).toBeCloseTo(3); // 4*0.5 + 2*0.5
    expect(out[4]).toBeCloseTo(4);
  });
  it("returns all null when there is not enough data", () => {
    expect(ema([1, 2], 3)).toEqual([null, null]);
  });
});

describe("rsi", () => {
  it("is 100 for a strictly rising series and 0 for a strictly falling one", () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    const down = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(last(rsi(up))).toBe(100);
    expect(last(rsi(down))).toBe(0);
  });
  it("is 50 for a flat series", () => {
    expect(last(rsi(new Array(30).fill(10)))).toBe(50);
  });
  it("matches a known Wilder RSI value", () => {
    // Classic Wilder example dataset (StockCharts); RSI(14) at bar 15 ≈ 70.46 (StockCharts shows 70.53 from rounded intermediate values)
    const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
    expect(rsi(closes, 14)[14]).toBeCloseTo(70.46, 1);
  });
});

describe("macd", () => {
  it("produces positive MACD for an accelerating uptrend", () => {
    const values = Array.from({ length: 80 }, (_, i) => 100 + i * i * 0.05);
    const m = last(macd(values));
    expect(m).not.toBeNull();
    expect(m!.macd).toBeGreaterThan(0);
    expect(m!.histogram).toBeCloseTo(m!.macd - m!.signal);
  });
});

describe("atr", () => {
  it("equals the constant range when every bar has the same range and no gaps", () => {
    const candles = Array.from({ length: 30 }, () => ({ high: 11, low: 9, close: 10 }));
    expect(last(atr(candles, 14))).toBeCloseTo(2);
  });
});
