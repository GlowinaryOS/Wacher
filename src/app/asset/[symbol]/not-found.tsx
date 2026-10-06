import Link from "next/link";

export default function AssetNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold text-text">Asset not on your watchlist</h1>
      <p className="mt-2 text-sm text-muted">Watcher only researches assets you have added yourself.</p>
      <Link href="/watchlist" className="mt-4 inline-block rounded-md bg-accent px-3 py-1.5 text-sm text-white">
        Go to watchlist
      </Link>
    </div>
  );
}
