import "server-only";

import { getConfig } from "@/lib/config/env";
import { LocalJsonRepository } from "./local";
import { SupabaseRepository } from "./supabase";
import type { WatcherRepository } from "./types";

let cached: WatcherRepository | null = null;

export function getRepository(): WatcherRepository {
  if (cached) return cached;
  const cfg = getConfig();
  if (cfg.dataBackend === "supabase") {
    const { url, serviceRoleKey, ownerUserId } = cfg.supabase;
    if (!url || !serviceRoleKey || !ownerUserId) {
      throw new Error(
        "WATCHER_DATA_BACKEND=supabase requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and WATCHER_OWNER_USER_ID",
      );
    }
    cached = new SupabaseRepository(url, serviceRoleKey, ownerUserId);
  } else {
    cached = new LocalJsonRepository(cfg.localDataDir);
  }
  return cached;
}

export { RepositoryError } from "./types";
export type { WatcherRepository } from "./types";
