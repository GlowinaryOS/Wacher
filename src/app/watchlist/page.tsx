import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { AssetForm } from "@/components/watchlist/AssetForm";
import { WatchlistTable } from "@/components/watchlist/WatchlistTable";
import { getRepository } from "@/lib/repositories";

export const metadata: Metadata = { title: "Watchlist" };

async function WatchlistContent() {
  await connection();
  const assets = await getRepository().listAssets();
  const active = assets.filter((a) => a.active).length;
  return (
    <Panel title="Assets" subtitle={`${assets.length} total · ${active} active · disabled assets are skipped by Daily Watch`}>
      <WatchlistTable assets={assets} />
    </Panel>
  );
}

export default function WatchlistPage() {
  return (
    <>
      <PageHeader
        title="Watchlist"
        subtitle="You control what Watcher watches. Removing an asset never deletes its recorded analyses or predictions."
      />
      <div className="space-y-4">
        <Panel title="Add asset" subtitle="Leave TradingView symbol blank to derive it from exchange + symbol (+ currency for crypto).">
          <AssetForm />
        </Panel>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <WatchlistContent />
        </Suspense>
      </div>
    </>
  );
}
