"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveAsset, type AssetFormState } from "@/app/watchlist/actions";
import type { WatchlistAsset } from "@/lib/domain/types";

const initial: AssetFormState = { ok: false, message: null, fieldErrors: {} };

function Field({
  label,
  name,
  error,
  children,
  className = "",
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={name} className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">{label}</span>
      {children}
      {error && <span className="text-xs text-bear">{error}</span>}
    </label>
  );
}

export function AssetForm({ asset, onDone }: { asset?: WatchlistAsset; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveAsset, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = asset ? `edit-${asset.id}-` : "new-";
  const fe = state.fieldErrors;

  useEffect(() => {
    if (state.ok) {
      if (!asset) formRef.current?.reset();
      onDone?.();
    }
  }, [state, asset, onDone]);

  return (
    <form ref={formRef} action={action} className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {asset && <input type="hidden" name="id" value={asset.id} />}
      <Field label="Symbol" name={`${prefix}symbol`} error={fe.symbol}>
        <input id={`${prefix}symbol`} name="symbol" required defaultValue={asset?.symbol} placeholder="BTC" className="uppercase" />
      </Field>
      <Field label="Name" name={`${prefix}name`} error={fe.name} className="col-span-1 xl:col-span-2">
        <input id={`${prefix}name`} name="name" required defaultValue={asset?.name} placeholder="Bitcoin" />
      </Field>
      <Field label="Type" name={`${prefix}assetType`} error={fe.assetType}>
        <select id={`${prefix}assetType`} name="assetType" defaultValue={asset?.assetType ?? "CRYPTO"}>
          <option value="CRYPTO">Crypto</option>
          <option value="STOCK">Stock</option>
          <option value="ETF">ETF</option>
        </select>
      </Field>
      <Field label="Exchange" name={`${prefix}exchange`} error={fe.exchange}>
        <input id={`${prefix}exchange`} name="exchange" required defaultValue={asset?.exchange} placeholder="COINBASE" className="uppercase" />
      </Field>
      <Field label="Currency" name={`${prefix}currency`} error={fe.currency}>
        <input id={`${prefix}currency`} name="currency" required defaultValue={asset?.currency ?? "USD"} className="uppercase" />
      </Field>
      <Field label="TradingView symbol" name={`${prefix}tradingViewSymbol`} error={fe.tradingViewSymbol} className="col-span-2">
        <input
          id={`${prefix}tradingViewSymbol`}
          name="tradingViewSymbol"
          defaultValue={asset?.tradingViewSymbol}
          placeholder="Auto: EXCHANGE:SYMBOL(CURRENCY)"
          className="uppercase"
        />
      </Field>
      <Field label="Notes" name={`${prefix}notes`} error={fe.notes} className="col-span-2 md:col-span-3 xl:col-span-6">
        <input id={`${prefix}notes`} name="notes" defaultValue={asset?.notes} placeholder="Why you watch it, levels you care about…" />
      </Field>
      <div className="col-span-2 flex items-end justify-between gap-3 md:col-span-1 xl:col-span-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="active" defaultChecked={asset?.active ?? true} className="h-4 w-4" />
          Active
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : asset ? "Save" : "Add asset"}
        </button>
      </div>
      {state.message && (
        <p role="status" className={`col-span-full text-sm ${state.ok ? "text-bull" : "text-bear"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
