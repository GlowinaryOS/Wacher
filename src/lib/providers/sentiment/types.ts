import type { SentimentItem, WatchlistAsset } from "@/lib/domain/types";

/**
 * Public-sentiment abstraction (Reddit, analyst commentary, …).
 * Sentiment is supporting evidence only and is never treated as fact.
 */
export interface SentimentProvider {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;
  getSentiment(asset: WatchlistAsset, opts?: { sinceHours?: number; limit?: number }): Promise<SentimentItem[]>;
}

export class NoSentimentProvider implements SentimentProvider {
  readonly id = "none";
  readonly label = "Not configured";
  readonly configured = false;
  async getSentiment(): Promise<SentimentItem[]> {
    return [];
  }
}
