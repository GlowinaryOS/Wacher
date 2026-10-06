import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_RISK_SETTINGS,
  RiskSettingsSchema,
  type AssetInput,
  type AssetType,
  type RiskSettings,
  type WatchlistAsset,
} from "@/lib/domain/types";
import { RepositoryError, type WatcherRepository } from "./types";

/**
 * Supabase/Postgres repository (schema: supabase/migrations/0001_initial_schema.sql).
 *
 * Runs server-side with the service-role key, so RLS is bypassed and every
 * query is explicitly scoped to WATCHER_OWNER_USER_ID. The key never reaches
 * the browser.
 */

interface AssetRow {
  id: string;
  symbol: string;
  name: string;
  asset_type: AssetType;
  exchange: string;
  currency: string;
  tradingview_symbol: string;
}

interface WatchlistAssetRow {
  id: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assets: AssetRow;
}

const SELECT_WATCHLIST_ASSET =
  "id, notes, is_active, created_at, updated_at, assets!inner(id, symbol, name, asset_type, exchange, currency, tradingview_symbol)";

function toDomain(row: WatchlistAssetRow): WatchlistAsset {
  return {
    id: row.id, // watchlist membership id
    symbol: row.assets.symbol,
    name: row.assets.name,
    assetType: row.assets.asset_type,
    exchange: row.assets.exchange,
    currency: row.assets.currency,
    tradingViewSymbol: row.assets.tradingview_symbol,
    notes: row.notes,
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fail(context: string, error: { message: string; code?: string }): never {
  if (error.code === "23505") throw new RepositoryError(`${context}: already exists`, "CONFLICT");
  throw new RepositoryError(`${context}: ${error.message}`, "BACKEND");
}

export class SupabaseRepository implements WatcherRepository {
  readonly backend = "supabase" as const;
  private readonly db: SupabaseClient;
  private watchlistId: string | null = null;

  constructor(url: string, serviceRoleKey: string, private readonly userId: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  private async defaultWatchlistId(): Promise<string> {
    if (this.watchlistId) return this.watchlistId;
    const { data, error } = await this.db
      .from("watchlists")
      .select("id")
      .eq("user_id", this.userId)
      .eq("is_default", true)
      .maybeSingle();
    if (error) fail("Load watchlist", error);
    if (data) return (this.watchlistId = data.id as string);

    const created = await this.db
      .from("watchlists")
      .insert({ user_id: this.userId, name: "Main", is_default: true })
      .select("id")
      .single();
    if (created.error) fail("Create watchlist", created.error);
    return (this.watchlistId = created.data.id as string);
  }

  async listAssets(): Promise<WatchlistAsset[]> {
    const wl = await this.defaultWatchlistId();
    const { data, error } = await this.db
      .from("watchlist_assets")
      .select(SELECT_WATCHLIST_ASSET)
      .eq("watchlist_id", wl)
      .eq("user_id", this.userId)
      .order("position")
      .order("created_at");
    if (error) fail("List assets", error);
    return (data as unknown as WatchlistAssetRow[]).map(toDomain);
  }

  async getAssetBySymbol(symbol: string): Promise<WatchlistAsset | null> {
    const wl = await this.defaultWatchlistId();
    const { data, error } = await this.db
      .from("watchlist_assets")
      .select(SELECT_WATCHLIST_ASSET)
      .eq("watchlist_id", wl)
      .eq("user_id", this.userId)
      .eq("assets.symbol", symbol.toUpperCase())
      .maybeSingle();
    if (error) fail("Load asset", error);
    return data ? toDomain(data as unknown as WatchlistAssetRow) : null;
  }

  private assetColumns(input: AssetInput) {
    return {
      symbol: input.symbol,
      name: input.name,
      asset_type: input.assetType,
      exchange: input.exchange,
      currency: input.currency,
      tradingview_symbol: input.tradingViewSymbol,
    };
  }

  async createAsset(input: AssetInput): Promise<WatchlistAsset> {
    const wl = await this.defaultWatchlistId();
    // Re-use an existing instrument row (it may carry history) or create one.
    const existing = await this.db
      .from("assets")
      .select("id")
      .eq("user_id", this.userId)
      .eq("symbol", input.symbol)
      .maybeSingle();
    if (existing.error) fail("Find asset", existing.error);

    let assetId = existing.data?.id as string | undefined;
    if (assetId) {
      const upd = await this.db.from("assets").update(this.assetColumns(input)).eq("id", assetId).eq("user_id", this.userId);
      if (upd.error) fail("Update asset", upd.error);
    } else {
      const ins = await this.db
        .from("assets")
        .insert({ user_id: this.userId, ...this.assetColumns(input) })
        .select("id")
        .single();
      if (ins.error) fail("Create asset", ins.error);
      assetId = ins.data.id as string;
    }

    const { data, error } = await this.db
      .from("watchlist_assets")
      .insert({ user_id: this.userId, watchlist_id: wl, asset_id: assetId, notes: input.notes, is_active: input.active })
      .select(SELECT_WATCHLIST_ASSET)
      .single();
    if (error) fail(`Add ${input.symbol}`, error);
    return toDomain(data as unknown as WatchlistAssetRow);
  }

  private async membership(id: string): Promise<{ asset_id: string }> {
    const { data, error } = await this.db
      .from("watchlist_assets")
      .select("asset_id")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) fail("Load watchlist entry", error);
    if (!data) throw new RepositoryError("Asset not found", "NOT_FOUND");
    return data as { asset_id: string };
  }

  async updateAsset(id: string, input: AssetInput): Promise<WatchlistAsset> {
    const { asset_id } = await this.membership(id);
    const upd = await this.db.from("assets").update(this.assetColumns(input)).eq("id", asset_id).eq("user_id", this.userId);
    if (upd.error) fail(`Update ${input.symbol}`, upd.error);
    const { data, error } = await this.db
      .from("watchlist_assets")
      .update({ notes: input.notes, is_active: input.active })
      .eq("id", id)
      .eq("user_id", this.userId)
      .select(SELECT_WATCHLIST_ASSET)
      .single();
    if (error) fail("Update watchlist entry", error);
    return toDomain(data as unknown as WatchlistAssetRow);
  }

  async setAssetActive(id: string, active: boolean): Promise<void> {
    const { error, count } = await this.db
      .from("watchlist_assets")
      .update({ is_active: active }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) fail("Toggle asset", error);
    if (count === 0) throw new RepositoryError("Asset not found", "NOT_FOUND");
  }

  async removeAsset(id: string): Promise<void> {
    // Only the membership is removed; the asset row and its history remain.
    const { error, count } = await this.db
      .from("watchlist_assets")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) fail("Remove asset", error);
    if (count === 0) throw new RepositoryError("Asset not found", "NOT_FOUND");
  }

  async getRiskSettings(): Promise<RiskSettings> {
    const { data, error } = await this.db.from("risk_settings").select("*").eq("user_id", this.userId).maybeSingle();
    if (error) fail("Load risk settings", error);
    if (!data) return DEFAULT_RISK_SETTINGS;
    return RiskSettingsSchema.parse({
      accountSize: data.account_size === null ? null : Number(data.account_size),
      accountCurrency: data.account_currency,
      maxRiskPerTradePct: Number(data.max_risk_per_trade_pct),
      maxDailyLossPct: Number(data.max_daily_loss_pct),
      maxOpenPaperTrades: Number(data.max_open_paper_trades),
      minRewardRisk: Number(data.min_reward_risk),
    });
  }

  async saveRiskSettings(s: RiskSettings): Promise<RiskSettings> {
    const { error } = await this.db.from("risk_settings").upsert({
      user_id: this.userId,
      account_size: s.accountSize,
      account_currency: s.accountCurrency,
      max_risk_per_trade_pct: s.maxRiskPerTradePct,
      max_daily_loss_pct: s.maxDailyLossPct,
      max_open_paper_trades: s.maxOpenPaperTrades,
      min_reward_risk: s.minRewardRisk,
    });
    if (error) fail("Save risk settings", error);
    return s;
  }
}
