"use client";

import Link from "next/link";
import { useState } from "react";
import { removeAsset, toggleAsset } from "@/app/watchlist/actions";
import { Badge } from "@/components/ui/primitives";
import type { WatchlistAsset } from "@/lib/domain/types";
import { AssetForm } from "./AssetForm";

function Row({ asset }: { asset: WatchlistAsset }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <tr className={`border-t border-border ${asset.active ? "" : "opacity-55"}`}>
        <td className="py-2 pr-3">
          <Link href={`/asset/${encodeURIComponent(asset.symbol)}`} className="num font-semibold text-accent hover:underline">
            {asset.symbol}
          </Link>
          <div className="text-xs text-muted">{asset.name}</div>
        </td>
        <td className="py-2 pr-3">
          <Badge>{asset.assetType}</Badge>
        </td>
        <td className="num hidden py-2 pr-3 text-xs text-muted md:table-cell">
          {asset.exchange} · {asset.currency}
        </td>
        <td className="num hidden py-2 pr-3 text-xs text-muted lg:table-cell">{asset.tradingViewSymbol}</td>
        <td className="hidden max-w-[320px] py-2 pr-3 text-xs text-muted xl:table-cell">
          <span className="line-clamp-2">{asset.notes || <span className="text-faint">—</span>}</span>
        </td>
        <td className="py-2 pr-3">{asset.active ? <Badge tone="bull">Active</Badge> : <Badge>Disabled</Badge>}</td>
        <td className="py-2 text-right whitespace-nowrap">
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded px-2 py-1 text-xs text-muted hover:bg-panel-2 hover:text-text"
            >
              {editing ? "Close" : "Edit"}
            </button>
            <form action={toggleAsset}>
              <input type="hidden" name="id" value={asset.id} />
              <input type="hidden" name="active" value={String(!asset.active)} />
              <button type="submit" className="rounded px-2 py-1 text-xs text-muted hover:bg-panel-2 hover:text-text">
                {asset.active ? "Disable" : "Enable"}
              </button>
            </form>
            <form
              action={removeAsset}
              onSubmit={(e) => {
                if (!confirm(`Remove ${asset.symbol} from the watchlist? Recorded history is kept.`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={asset.id} />
              <button type="submit" className="rounded px-2 py-1 text-xs text-bear hover:bg-bear/10">
                Remove
              </button>
            </form>
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="bg-panel-2/50">
          <td colSpan={7} className="p-3">
            <AssetForm asset={asset} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

export function WatchlistTable({ assets }: { assets: WatchlistAsset[] }) {
  if (assets.length === 0) {
    return <p className="text-sm text-faint">Your watchlist is empty. Add an asset above.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[10px] tracking-[0.12em] text-faint uppercase">
            <th className="pr-3 pb-2 font-semibold">Asset</th>
            <th className="pr-3 pb-2 font-semibold">Type</th>
            <th className="hidden pr-3 pb-2 font-semibold md:table-cell">Exchange</th>
            <th className="hidden pr-3 pb-2 font-semibold lg:table-cell">TradingView</th>
            <th className="hidden pr-3 pb-2 font-semibold xl:table-cell">Notes</th>
            <th className="pr-3 pb-2 font-semibold">Status</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <Row key={a.id} asset={a} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
