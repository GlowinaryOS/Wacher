import { describe, expect, it } from "vitest";
import { DEFAULT_RISK_SETTINGS } from "@/lib/domain/types";
import { sizePosition } from "./position-sizing";

const rules = { ...DEFAULT_RISK_SETTINGS, accountSize: 10_000, maxRiskPerTradePct: 1, minRewardRisk: 2 };

describe("sizePosition", () => {
  it("sizes a long from the user's max risk and stop distance", () => {
    const r = sizePosition({ direction: "LONG", entry: 100, stop: 95, target1: 115, target2: 125 }, rules);
    expect(r.riskPerUnit).toBe(5);
    expect(r.maxRiskAmount).toBe(100);
    expect(r.positionSizeUnits).toBe(20);
    expect(r.positionNotional).toBe(2000);
    expect(r.potentialLoss).toBe(100);
    expect(r.potentialRewardT1).toBe(300);
    expect(r.rewardRiskT1).toBe(3);
    expect(r.rewardRiskT2).toBe(5);
    expect(r.violations).toEqual([]);
  });

  it("handles shorts symmetrically", () => {
    const r = sizePosition({ direction: "SHORT", entry: 100, stop: 105, target1: 85 }, rules);
    expect(r.rewardRiskT1).toBe(3);
    expect(r.positionSizeUnits).toBe(20);
    expect(r.violations).toEqual([]);
  });

  it("warns when reward/risk is below the user's minimum", () => {
    const r = sizePosition({ direction: "LONG", entry: 100, stop: 95, target1: 105 }, rules);
    expect(r.violations.some((v) => v.includes("below your minimum"))).toBe(true);
  });

  it("flags a stop on the wrong side and does not size it", () => {
    const r = sizePosition({ direction: "LONG", entry: 100, stop: 101, target1: 110 }, rules);
    expect(r.violations.some((v) => v.includes("wrong side"))).toBe(true);
    expect(r.positionSizeUnits).toBeNull();
  });

  it("does not size anything without a user-defined account size", () => {
    const r = sizePosition({ direction: "LONG", entry: 100, stop: 95, target1: 115 }, { ...rules, accountSize: null });
    expect(r.positionSizeUnits).toBeNull();
    expect(r.maxRiskAmount).toBeNull();
  });

  it("warns when a tight stop would need more than the whole account", () => {
    const r = sizePosition({ direction: "LONG", entry: 100, stop: 99.9, target1: 101 }, rules);
    expect(r.violations.some((v) => v.includes("exceeds account size"))).toBe(true);
  });
});
