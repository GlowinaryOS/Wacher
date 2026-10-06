import type {
  Analysis,
  MarketRegime,
  NewsItem,
  Quote,
  RiskSettings,
  SentimentItem,
  TechnicalSummary,
  WatchlistAsset,
} from "@/lib/domain/types";

/**
 * Everything the reasoning layer is allowed to see. The analysis provider
 * receives only this structured document — it never reads the TradingView
 * iframe and never fetches data itself.
 */
export interface AnalysisInput {
  asset: Pick<WatchlistAsset, "symbol" | "name" | "assetType" | "exchange" | "currency">;
  dataTimestamp: string;
  quote: Quote;
  technicals: TechnicalSummary;
  marketRegime: MarketRegime | null;
  news: NewsItem[];
  sentiment: SentimentItem[];
  riskRules: RiskSettings;
  previousAnalysis: Analysis | null;
  missingData: string[];
}

export interface AnalysisProvider {
  readonly id: string;
  readonly label: string;
  readonly isMock: boolean;
  readonly configured: boolean;
  analyse(input: AnalysisInput): Promise<Analysis | null>;
}

export class NoAnalysisProvider implements AnalysisProvider {
  readonly id = "none";
  readonly label = "Not configured";
  readonly isMock = false;
  readonly configured = false;
  async analyse(): Promise<Analysis | null> {
    return null;
  }
}
