import type { AssetInput, RiskSettings, WatchlistAsset } from "@/lib/domain/types";

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "BACKEND",
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

/** Persistence boundary. Implemented by a local JSON store (dev) and Supabase. */
export interface WatcherRepository {
  readonly backend: "local" | "supabase";
  listAssets(): Promise<WatchlistAsset[]>;
  getAssetBySymbol(symbol: string): Promise<WatchlistAsset | null>;
  createAsset(input: AssetInput): Promise<WatchlistAsset>;
  updateAsset(id: string, input: AssetInput): Promise<WatchlistAsset>;
  setAssetActive(id: string, active: boolean): Promise<void>;
  /** Removes the asset from the watchlist. Historical analyses/predictions are never deleted. */
  removeAsset(id: string): Promise<void>;
  getRiskSettings(): Promise<RiskSettings>;
  saveRiskSettings(settings: RiskSettings): Promise<RiskSettings>;
}
