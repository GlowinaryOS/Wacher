import {
  AnalysisSchema,
  type Analysis,
  type AnalysisBody,
  type Direction,
  type Scenario,
  type TimeframeTechnicals,
  type TradeSetup,
} from "@/lib/domain/types";
import { sizePosition } from "@/lib/risk/position-sizing";
import type { AnalysisInput, AnalysisProvider } from "./types";

/**
 * MOCK ANALYSIS — a transparent, deterministic rule set standing in for the
 * Claude analysis engine during Phase 1. It is not an LLM, it reads no news,
 * and its output is not a recommendation. It exists so the UI and data shape
 * can be exercised end-to-end before real providers are connected.
 */

const r = (n: number) => Number(n.toPrecision(6));

function pick(input: AnalysisInput, tf: TimeframeTechnicals["timeframe"]) {
  return input.technicals.timeframes.find((t) => t.timeframe === tf) ?? null;
}

function buildSetup(input: AnalysisInput, direction: Direction): TradeSetup | null {
  // Execution timeframe: 4H where analysed (crypto), otherwise 1H (stocks/ETFs).
  const h4 = pick(input, "4H") ?? pick(input, "1H");
  const d1 = pick(input, "1D");
  if (!h4 || !d1 || !h4.atr14) return null;
  const atr = h4.atr14;
  const px = input.quote.price;
  const long = direction === "LONG";

  const entryNear = px;
  const entryFar = long ? px - 0.5 * atr : px + 0.5 * atr;
  const structural = long ? h4.support : h4.resistance;
  const structuralOk =
    structural !== null && (long ? structural < entryFar : structural > entryFar) && Math.abs(structural - px) < 3 * atr;
  const stop = structuralOk
    ? long
      ? structural! - 0.25 * atr
      : structural! + 0.25 * atr
    : long
      ? entryFar - 1.5 * atr
      : entryFar + 1.5 * atr;

  const mid = (entryNear + entryFar) / 2;
  const risk = Math.abs(mid - stop);
  const htfLevel = long ? d1.resistance : d1.support;
  const target1 =
    htfLevel !== null && (long ? htfLevel > mid + risk : htfLevel < mid - risk) ? htfLevel : long ? mid + 2 * risk : mid - 2 * risk;
  const target2 = long ? mid + 3.5 * risk : mid - 3.5 * risk;
  if (!long && (stop <= 0 || target2 <= 0)) return null;

  return {
    direction,
    entryLow: r(Math.min(entryNear, entryFar)),
    entryHigh: r(Math.max(entryNear, entryFar)),
    stop: r(stop),
    target1: r(target1),
    target2: r(target2),
    timeframe: "Swing: 3–15 days",
    confidence: 55,
    reasoning: `[MOCK] All analysed timeframes show ${long ? "bullish" : "bearish"} structure with price ${
      long ? "above" : "below"
    } the 50-period average. Stop placed ${structuralOk ? `beyond the nearest ${h4.timeframe} swing level` : "1.5×ATR beyond the entry zone"}.`,
    catalysts: ["[MOCK] No news provider configured — catalysts unknown"],
    risks: [
      "[MOCK] Synthetic data — this setup does not describe the real market",
      "Market regime unknown",
      "News and sentiment not assessed",
    ],
    invalidationCondition: `A ${h4.timeframe} close ${long ? "below" : "above"} ${r(stop)} invalidates the setup.`,
  };
}

function scenario(probability: number, reasoning: string, levels: Scenario["levels"], invalidation: string): Scenario {
  return {
    probability,
    reasoning,
    levels,
    catalysts: ["[MOCK] Catalysts require a news provider"],
    invalidation,
    timeframe: "1–3 weeks",
  };
}

export function mockAnalyse(input: AnalysisInput): AnalysisBody {
  const t = input.technicals;
  const d1 = pick(input, "1D");
  const res = d1?.resistance ?? null;
  const sup = d1?.support ?? null;
  const lvl = (label: string, price: number | null) => (price ? [{ label, price: r(price) }] : []);

  const facts = t.timeframes.map(
    (tf) =>
      `${tf.timeframe}: structure ${tf.structure}, trend ${tf.trend}, RSI14 ${tf.rsi14?.toFixed(1) ?? "n/a"}, close ${r(tf.lastClose)}`,
  );
  const interpretation = t.timeframes.map((tf) => `${tf.timeframe} bias: ${tf.bias}`);
  if (t.conflict) interpretation.push("TIMEFRAMES CONFLICT — higher and lower timeframes disagree");

  let probs: [number, number, number] = [25, 50, 25];
  if (t.alignment === "BULLISH") probs = [50, 35, 15];
  else if (t.alignment === "BEARISH") probs = [15, 35, 50];
  else if (t.alignment === "CONFLICT") probs = [30, 40, 30];

  const thesisBias = t.alignment === "CONFLICT" ? "NEUTRAL" : t.alignment;

  let decision: AnalysisBody["decision"] = "NO_TRADE";
  let decisionReason = "No timeframe shows a clear directional structure.";
  let setup: TradeSetup | null = null;

  if (t.conflict) {
    decisionReason = "TIMEFRAMES CONFLICT — no trade while timeframes disagree.";
  } else if (t.alignment === "BULLISH" || t.alignment === "BEARISH") {
    const direction: Direction = t.alignment === "BULLISH" ? "LONG" : "SHORT";
    const candidate = buildSetup(input, direction);
    const extended =
      d1?.rsi14 != null && (direction === "LONG" ? d1.rsi14 > 75 : d1.rsi14 < 25);
    if (!candidate) {
      decision = "WATCH";
      decisionReason = "Directional alignment, but not enough data to define entry, stop and targets.";
    } else {
      const sizing = sizePosition(
        { direction, entry: (candidate.entryLow + candidate.entryHigh) / 2, stop: candidate.stop, target1: candidate.target1, target2: candidate.target2 },
        input.riskRules,
      );
      if (extended) {
        decision = "WATCH";
        decisionReason = "Aligned trend but the daily chart is extended (RSI). Wait for a pullback rather than chase.";
      } else if (sizing.rewardRiskT1 < input.riskRules.minRewardRisk) {
        decision = "WATCH";
        decisionReason = `Aligned trend but reward/risk to Target 1 is ${sizing.rewardRiskT1.toFixed(2)}R, below your ${input.riskRules.minRewardRisk}R minimum.`;
      } else {
        decision = "TRADE";
        decisionReason = `All timeframes aligned ${t.alignment.toLowerCase()}; defined invalidation with ${sizing.rewardRiskT1.toFixed(2)}R to Target 1.`;
        setup = candidate;
      }
    }
  } else if (t.timeframes.some((tf) => tf.bias !== "NEUTRAL")) {
    decision = "WATCH";
    decisionReason = "Partial directional evidence only — some timeframes are neutral.";
  }

  const bullish = thesisBias === "BULLISH";
  const bearish = thesisBias === "BEARISH";

  return {
    currentView: `[MOCK] ${input.asset.symbol} technical alignment is ${t.alignment}. This is a rule-based placeholder computed from synthetic data, not real analysis.`,
    facts,
    interpretation,
    thesisBias,
    scenarios: {
      bull: scenario(probs[0], "[MOCK] Higher-timeframe structure continues upward and resistance breaks.", lvl("Daily resistance", res), sup ? `Daily close below ${r(sup)}` : "Loss of the most recent swing low"),
      base: scenario(probs[1], "[MOCK] Price ranges between nearby daily support and resistance.", [...lvl("Daily support", sup), ...lvl("Daily resistance", res)], "A decisive daily close outside the range"),
      bear: scenario(probs[2], "[MOCK] Support fails and lower-timeframe weakness spreads to the daily chart.", lvl("Daily support", sup), res ? `Daily close above ${r(res)}` : "A new swing high"),
    },
    keyLevels: t.keyLevels.slice(0, 6).map((k) => ({ label: k.label, price: r(k.price) })),
    invalidation: bullish
      ? `Bullish view invalid on a daily close below ${sup ? r(sup) : "the latest swing low"}.`
      : bearish
        ? `Bearish view invalid on a daily close above ${res ? r(res) : "the latest swing high"}.`
        : "No directional thesis to invalidate.",
    risk: "[MOCK] Regime, news and sentiment are not assessed. Data is synthetic.",
    strongestCounterArgument: bullish
      ? "STRONGEST BEARISH ARGUMENT: [MOCK] trend may be late-stage; without volume and macro context, a failed breakout at resistance is equally plausible."
      : bearish
        ? "STRONGEST BULLISH ARGUMENT: [MOCK] downtrends often end in capitulation near support; a reclaim of the 50-period average would trap shorts."
        : "[MOCK] With no directional thesis, the risk is missing the start of a new trend — mitigated by waiting for confirmation.",
    whatWouldChangeMyMind: [
      bullish ? "A daily close below support" : bearish ? "A daily close above resistance" : "A clean break with volume from the current range",
      "Timeframes moving into conflict",
      "Material news (not assessed in mock mode)",
    ],
    missingInformation: [...input.missingData, "Real market data", "News", "Sentiment", "Market regime"],
    timeframesConflict: t.conflict,
    decision,
    decisionReason,
    setup,
  };
}

export class MockAnalysisProvider implements AnalysisProvider {
  readonly id = "mock";
  readonly label = "Rule-based mock (not Claude)";
  readonly isMock = true;
  readonly configured = true;

  async analyse(input: AnalysisInput): Promise<Analysis | null> {
    if (!Number.isFinite(input.quote.price)) return null;
    const body = AnalysisSchema.parse(mockAnalyse(input));
    return {
      ...body,
      meta: {
        modelName: "watcher-mock-rules",
        modelVersion: "0.1.0",
        promptVersion: "none",
        analysisVersion: "phase1-mock-1",
        dataTimestamp: input.dataTimestamp,
        generatedAt: new Date().toISOString(),
        isMock: true,
      },
    };
  }
}
