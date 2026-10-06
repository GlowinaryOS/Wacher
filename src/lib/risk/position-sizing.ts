import { fmtR } from "@/lib/format";
import type { Direction, RiskSettings } from "@/lib/domain/types";

export interface SizingInput {
  direction: Direction;
  entry: number;
  stop: number;
  target1: number;
  target2?: number | null;
}

export interface SizingResult {
  riskPerUnit: number;
  rewardRiskT1: number;
  rewardRiskT2: number | null;
  /** Only present when the user has defined an account size. */
  maxRiskAmount: number | null;
  positionSizeUnits: number | null;
  positionNotional: number | null;
  potentialLoss: number | null;
  potentialRewardT1: number | null;
  violations: string[];
}

/**
 * Hypothetical sizing from the user's own rules. Watcher never suggests
 * risking more because capital is available, and never sizes up after a loss.
 */
export function sizePosition(input: SizingInput, rules: RiskSettings): SizingResult {
  const { direction, entry, stop, target1, target2 } = input;
  const violations: string[] = [];

  if (!(entry > 0 && stop > 0 && target1 > 0)) {
    throw new Error("Entry, stop and target must be positive numbers");
  }
  const stopWrongSide = direction === "LONG" ? stop >= entry : stop <= entry;
  const targetWrongSide = direction === "LONG" ? target1 <= entry : target1 >= entry;
  if (stopWrongSide) violations.push(`Stop is on the wrong side of entry for a ${direction}`);
  if (targetWrongSide) violations.push(`Target 1 is on the wrong side of entry for a ${direction}`);

  const riskPerUnit = Math.abs(entry - stop);
  const rr = (t: number) => (riskPerUnit > 0 ? Math.abs(t - entry) / riskPerUnit : 0);
  const rewardRiskT1 = rr(target1);
  const rewardRiskT2 = target2 ? rr(target2) : null;

  if (rewardRiskT1 < rules.minRewardRisk) {
    violations.push(
      `Reward/risk to Target 1 is ${fmtR(rewardRiskT1)}, below your minimum of ${rules.minRewardRisk}R`,
    );
  }

  let maxRiskAmount: number | null = null;
  let positionSizeUnits: number | null = null;
  let positionNotional: number | null = null;
  let potentialLoss: number | null = null;
  let potentialRewardT1: number | null = null;

  if (rules.accountSize && riskPerUnit > 0 && !stopWrongSide) {
    maxRiskAmount = (rules.accountSize * rules.maxRiskPerTradePct) / 100;
    positionSizeUnits = maxRiskAmount / riskPerUnit;
    positionNotional = positionSizeUnits * entry;
    potentialLoss = positionSizeUnits * riskPerUnit;
    potentialRewardT1 = positionSizeUnits * Math.abs(target1 - entry);
    if (positionNotional > rules.accountSize) {
      violations.push("Position notional exceeds account size at this stop distance (would require leverage)");
    }
  }

  return {
    riskPerUnit,
    rewardRiskT1,
    rewardRiskT2,
    maxRiskAmount,
    positionSizeUnits,
    positionNotional,
    potentialLoss,
    potentialRewardT1,
    violations,
  };
}
