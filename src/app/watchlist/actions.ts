"use server";

import { refresh } from "next/cache";
import { AssetInputSchema } from "@/lib/domain/types";
import { defaultTradingViewSymbol } from "@/lib/providers/tradingview/symbols";
import { getRepository, RepositoryError } from "@/lib/repositories";

export interface AssetFormState {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string>;
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export async function saveAsset(_prev: AssetFormState, fd: FormData): Promise<AssetFormState> {
  const id = str(fd, "id");
  const parsed = AssetInputSchema.safeParse({
    symbol: str(fd, "symbol"),
    name: str(fd, "name"),
    assetType: str(fd, "assetType"),
    exchange: str(fd, "exchange"),
    currency: str(fd, "currency"),
    tradingViewSymbol: str(fd, "tradingViewSymbol"),
    notes: str(fd, "notes"),
    active: fd.get("active") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      fieldErrors[k] ??= issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };
  }

  const input = parsed.data;
  if (!input.tradingViewSymbol) {
    input.tradingViewSymbol = defaultTradingViewSymbol(input.symbol, input.exchange, input.assetType, input.currency);
  }

  try {
    const repo = getRepository();
    if (id) await repo.updateAsset(id, input);
    else await repo.createAsset(input);
  } catch (e) {
    const msg = e instanceof RepositoryError ? e.message : "Could not save the asset.";
    if (!(e instanceof RepositoryError)) console.error(e);
    return { ok: false, message: msg, fieldErrors: {} };
  }
  refresh();
  return { ok: true, message: id ? `${input.symbol} updated.` : `${input.symbol} added.`, fieldErrors: {} };
}

export async function toggleAsset(fd: FormData): Promise<void> {
  await getRepository().setAssetActive(str(fd, "id"), str(fd, "active") === "true");
  refresh();
}

export async function removeAsset(fd: FormData): Promise<void> {
  await getRepository().removeAsset(str(fd, "id"));
  refresh();
}
