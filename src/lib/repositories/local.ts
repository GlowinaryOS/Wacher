import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  AssetTypeSchema,
  DEFAULT_RISK_SETTINGS,
  RiskSettingsSchema,
  type AssetInput,
  type RiskSettings,
  type WatchlistAsset,
} from "@/lib/domain/types";
import { EXAMPLE_WATCHLIST } from "./seed";
import { RepositoryError, type WatcherRepository } from "./types";

/**
 * Local development store: a single JSON file on disk (gitignored).
 * Suitable for running Watcher privately on your own machine. Use the
 * Supabase backend for anything hosted.
 */

const StoredAssetSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  assetType: AssetTypeSchema,
  exchange: z.string(),
  currency: z.string(),
  tradingViewSymbol: z.string(),
  notes: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const StoreSchema = z.object({
  version: z.literal(1),
  assets: z.array(StoredAssetSchema),
  riskSettings: RiskSettingsSchema,
});
type Store = z.infer<typeof StoreSchema>;

export class LocalJsonRepository implements WatcherRepository {
  readonly backend = "local" as const;
  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.file = path.resolve(process.cwd(), dir, "watcher.json");
  }

  private seeding: Promise<void> | null = null;

  /** Create and seed the store exactly once, even when several requests arrive together. */
  private ensureSeeded(): Promise<void> {
    this.seeding ??= (async () => {
      try {
        await readFile(this.file, "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        const now = new Date().toISOString();
        await this.save({
          version: 1,
          assets: EXAMPLE_WATCHLIST.map((a) => ({ ...a, id: randomUUID(), createdAt: now, updatedAt: now })),
          riskSettings: DEFAULT_RISK_SETTINGS,
        });
      }
    })().catch((err) => {
      this.seeding = null;
      throw err;
    });
    return this.seeding;
  }

  private async load(): Promise<Store> {
    await this.ensureSeeded();
    const raw = await readFile(this.file, "utf8");
    const parsed = StoreSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new RepositoryError(`Local store at ${this.file} is invalid: ${parsed.error.message}`, "BACKEND");
    }
    return parsed.data;
  }

  private async save(store: Store): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await rename(tmp, this.file); // atomic replace
  }

  /** Serialise read-modify-write cycles within this process. */
  private mutate<T>(fn: (store: Store) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const store = await this.load();
      const result = await fn(store);
      await this.save(store);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listAssets(): Promise<WatchlistAsset[]> {
    await this.queue;
    return (await this.load()).assets;
  }

  async getAssetBySymbol(symbol: string): Promise<WatchlistAsset | null> {
    const s = symbol.toUpperCase();
    return (await this.listAssets()).find((a) => a.symbol === s) ?? null;
  }

  createAsset(input: AssetInput): Promise<WatchlistAsset> {
    return this.mutate((store) => {
      if (store.assets.some((a) => a.symbol === input.symbol)) {
        throw new RepositoryError(`${input.symbol} is already on the watchlist`, "CONFLICT");
      }
      const now = new Date().toISOString();
      const asset: WatchlistAsset = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      store.assets.push(asset);
      return asset;
    });
  }

  updateAsset(id: string, input: AssetInput): Promise<WatchlistAsset> {
    return this.mutate((store) => {
      const idx = store.assets.findIndex((a) => a.id === id);
      if (idx === -1) throw new RepositoryError("Asset not found", "NOT_FOUND");
      if (store.assets.some((a) => a.symbol === input.symbol && a.id !== id)) {
        throw new RepositoryError(`${input.symbol} is already on the watchlist`, "CONFLICT");
      }
      const updated: WatchlistAsset = { ...store.assets[idx], ...input, updatedAt: new Date().toISOString() };
      store.assets[idx] = updated;
      return updated;
    });
  }

  setAssetActive(id: string, active: boolean): Promise<void> {
    return this.mutate((store) => {
      const a = store.assets.find((x) => x.id === id);
      if (!a) throw new RepositoryError("Asset not found", "NOT_FOUND");
      a.active = active;
      a.updatedAt = new Date().toISOString();
    });
  }

  removeAsset(id: string): Promise<void> {
    return this.mutate((store) => {
      const before = store.assets.length;
      store.assets = store.assets.filter((a) => a.id !== id);
      if (store.assets.length === before) throw new RepositoryError("Asset not found", "NOT_FOUND");
    });
  }

  async getRiskSettings(): Promise<RiskSettings> {
    await this.queue;
    return (await this.load()).riskSettings;
  }

  saveRiskSettings(settings: RiskSettings): Promise<RiskSettings> {
    return this.mutate((store) => {
      store.riskSettings = settings;
      return settings;
    });
  }
}
