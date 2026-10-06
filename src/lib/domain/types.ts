import { z } from "zod";

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const ASSET_TYPES = ["CRYPTO", "STOCK", "ETF"] as const;
export const AssetTypeSchema = z.enum(ASSET_TYPES);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const TIMEFRAMES = ["15M", "1H", "4H", "1D", "1W"] as const;
export const TimeframeSchema = z.enum(TIMEFRAMES);
export type Timeframe = z.infer<typeof TimeframeSchema>;

export const BIASES = ["BULLISH", "NEUTRAL", "BEARISH"] as const;
export type Bias = (typeof BIASES)[number];

export const REGIMES = ["BULLISH", "NEUTRAL", "BEARISH", "UNCLEAR"] as const;
export type RegimeClassification = (typeof REGIMES)[number];

/** TRADE = a setup exists; WATCH = interesting, not enough evidence; NO_TRADE = stand aside. */
export const DECISIONS = ["TRADE", "WATCH", "NO_TRADE"] as const;
export type Decision = (typeof DECISIONS)[number];

export const DIRECTIONS = ["LONG", "SHORT"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const PREDICTION_STATUSES = [
  "OPEN",
  "TARGET_1_HIT",
  "TARGET_2_HIT",
  "STOPPED_OUT",
  "INVALIDATED",
  "EXPIRED",
  "CANCELLED",
  "NO_TRADE",
] as const;
export type PredictionStatus = (typeof PREDICTION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Provenance — every externally sourced value says where it came from.
// ---------------------------------------------------------------------------

export interface Provenance {
  provider: string;
  asOf: string; // ISO timestamp of the data, not of the request
  isMock: boolean;
}

// ---------------------------------------------------------------------------
// Watchlist / assets
// ---------------------------------------------------------------------------

export interface WatchlistAsset {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  exchange: string;
  currency: string;
  /** Full TradingView symbol, e.g. "COINBASE:BTCUSD" or "NASDAQ:NVDA". */
  tradingViewSymbol: string;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const symbolRegex = /^[A-Z0-9.\-]{1,20}$/;

export const AssetInputSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(symbolRegex, "Symbol: 1–20 chars, A–Z, 0–9, '.' or '-'"),
  name: z.string().trim().min(1, "Name is required").max(100),
  assetType: AssetTypeSchema,
  exchange: z.string().trim().toUpperCase().min(1, "Exchange is required").max(40),
  currency: z.string().trim().toUpperCase().min(3).max(5),
  tradingViewSymbol: z
    .string()
    .trim()
    .toUpperCase()
    .max(60)
    .regex(/^([A-Z0-9_]+:)?[A-Z0-9.\-!_]+$/, "TradingView symbol looks invalid")
    .or(z.literal("")),
  notes: z.string().max(2000).default(""),
  active: z.boolean().default(true),
});
export type AssetInput = z.infer<typeof AssetInputSchema>;

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export interface Candle {
  time: number; // unix ms, candle open
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CandleSchema = z
  .object({
    time: z.number().int().positive(),
    open: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    close: z.number().positive(),
    volume: z.number().nonnegative(),
  })
  .refine((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close), {
    message: "Candle high/low inconsistent with open/close",
  });

export interface Quote extends Provenance {
  symbol: string;
  price: number;
  change24hPct: number;
  marketStatus: "OPEN" | "CLOSED" | "24/7" | "UNKNOWN";
}

export interface CandleSeries extends Provenance {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
}

// ---------------------------------------------------------------------------
// Technical analysis (computed by Watcher, never by the LLM)
// ---------------------------------------------------------------------------

export type StructureLabel =
  | "HH_HL" // higher highs, higher lows
  | "LH_LL" // lower highs, lower lows
  | "RANGE"
  | "MIXED"
  | "INSUFFICIENT_DATA";

export interface TimeframeTechnicals {
  timeframe: Timeframe;
  lastClose: number;
  structure: StructureLabel;
  trend: "UP" | "DOWN" | "SIDEWAYS";
  bias: Bias;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema21: number | null;
  rsi14: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  atr14: number | null;
  atrPct: number | null;
  volumeVsAvg20: number | null;
  swingHighs: number[]; // most recent last
  swingLows: number[];
  support: number | null;
  resistance: number | null;
  notes: string[];
}

export interface TechnicalSummary {
  timeframes: TimeframeTechnicals[];
  conflict: boolean;
  alignment: Bias | "CONFLICT";
  keyLevels: { label: string; price: number }[];
}

// ---------------------------------------------------------------------------
// News & sentiment
// ---------------------------------------------------------------------------

export const NewsItemSchema = z.object({
  source: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  publishedAt: z.iso.datetime({ offset: true }),
  assetSymbols: z.array(z.string()),
  summary: z.string(),
  importance: z.enum(["HIGH", "MEDIUM", "LOW"]),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED"]),
  provider: z.string(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export const SentimentItemSchema = z.object({
  source: z.string().min(1),
  community: z.string(),
  timestamp: z.iso.datetime({ offset: true }),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED"]),
  summary: z.string(),
  relevance: z.enum(["HIGH", "MEDIUM", "LOW"]),
  url: z.url().optional(),
  provider: z.string(),
});
export type SentimentItem = z.infer<typeof SentimentItemSchema>;

// ---------------------------------------------------------------------------
// Analysis (output of the reasoning layer, validated before use)
// ---------------------------------------------------------------------------

export const ScenarioSchema = z.object({
  probability: z.number().min(0).max(100),
  reasoning: z.string().min(1),
  levels: z.array(z.object({ label: z.string(), price: z.number().positive() })),
  catalysts: z.array(z.string()),
  invalidation: z.string().min(1),
  timeframe: z.string().min(1),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const TradeSetupSchema = z.object({
  direction: z.enum(DIRECTIONS),
  entryLow: z.number().positive(),
  entryHigh: z.number().positive(),
  stop: z.number().positive(),
  target1: z.number().positive(),
  target2: z.number().positive().nullable(),
  timeframe: z.string().min(1),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().min(1),
  catalysts: z.array(z.string()),
  risks: z.array(z.string()),
  invalidationCondition: z.string().min(1),
});
export type TradeSetup = z.infer<typeof TradeSetupSchema>;

export const AnalysisSchema = z
  .object({
    currentView: z.string().min(1),
    facts: z.array(z.string()),
    interpretation: z.array(z.string()),
    thesisBias: z.enum(BIASES),
    scenarios: z.object({ bull: ScenarioSchema, base: ScenarioSchema, bear: ScenarioSchema }),
    keyLevels: z.array(z.object({ label: z.string(), price: z.number().positive() })),
    invalidation: z.string().min(1),
    risk: z.string().min(1),
    strongestCounterArgument: z.string().min(1),
    whatWouldChangeMyMind: z.array(z.string()).min(1),
    missingInformation: z.array(z.string()),
    timeframesConflict: z.boolean(),
    decision: z.enum(DECISIONS),
    decisionReason: z.string().min(1),
    setup: TradeSetupSchema.nullable(),
  })
  .refine(
    (a) => {
      const s = a.scenarios;
      return Math.abs(s.bull.probability + s.base.probability + s.bear.probability - 100) <= 1;
    },
    { message: "Scenario probabilities must sum to 100" },
  )
  .refine((a) => (a.decision === "TRADE") === (a.setup !== null), {
    message: "A setup must be present if and only if the decision is TRADE",
  });
export type AnalysisBody = z.infer<typeof AnalysisSchema>;

export interface AnalysisMeta {
  modelName: string;
  modelVersion: string;
  promptVersion: string;
  analysisVersion: string;
  dataTimestamp: string;
  generatedAt: string;
  isMock: boolean;
}

export interface Analysis extends AnalysisBody {
  meta: AnalysisMeta;
}

export interface MarketRegime {
  market: "CRYPTO" | "STOCKS";
  classification: RegimeClassification;
  reasoning: string;
  missingData: string[];
  asOf: string;
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export const RiskSettingsSchema = z.object({
  accountSize: z.number().positive().nullable(),
  accountCurrency: z.string().trim().toUpperCase().min(3).max(5),
  maxRiskPerTradePct: z.number().gt(0).max(10),
  maxDailyLossPct: z.number().gt(0).max(25),
  maxOpenPaperTrades: z.number().int().min(1).max(100),
  minRewardRisk: z.number().min(0.5).max(10),
});
export type RiskSettings = z.infer<typeof RiskSettingsSchema>;

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  accountSize: null,
  accountCurrency: "GBP",
  maxRiskPerTradePct: 1,
  maxDailyLossPct: 3,
  maxOpenPaperTrades: 5,
  minRewardRisk: 2,
};
