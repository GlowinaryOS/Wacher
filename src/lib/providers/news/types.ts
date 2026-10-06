import type { NewsItem, WatchlistAsset } from "@/lib/domain/types";

/**
 * News source abstraction. Implementations must return only items that carry
 * a real source, URL and publication time, validated with NewsItemSchema.
 */
export interface NewsProvider {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;
  getNews(asset: WatchlistAsset, opts?: { sinceHours?: number; limit?: number }): Promise<NewsItem[]>;
}

export class NoNewsProvider implements NewsProvider {
  readonly id = "none";
  readonly label = "Not configured";
  readonly configured = false;
  async getNews(): Promise<NewsItem[]> {
    return [];
  }
}
