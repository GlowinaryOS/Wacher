"use client";

import { useActionState } from "react";
import { saveRiskSettings, type RiskFormState } from "@/app/settings/actions";
import type { RiskSettings } from "@/lib/domain/types";

const initial: RiskFormState = { ok: false, message: null };

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export function RiskForm({ settings }: { settings: RiskSettings }) {
  const [state, action, pending] = useActionState(saveRiskSettings, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <F label="Account size (for sizing only)" hint="Optional. Used only to calculate hypothetical position sizes.">
        <input name="accountSize" type="number" min="0" step="any" defaultValue={settings.accountSize ?? ""} placeholder="e.g. 10000" />
      </F>
      <F label="Account currency">
        <input name="accountCurrency" defaultValue={settings.accountCurrency} className="uppercase" />
      </F>
      <F label="Max risk per trade (%)" hint="Of account size, lost if the stop is hit.">
        <input name="maxRiskPerTradePct" type="number" min="0.01" max="10" step="0.01" defaultValue={settings.maxRiskPerTradePct} />
      </F>
      <F label="Max daily loss (%)" hint="Stop trading for the day beyond this.">
        <input name="maxDailyLossPct" type="number" min="0.1" max="25" step="0.1" defaultValue={settings.maxDailyLossPct} />
      </F>
      <F label="Max open paper trades">
        <input name="maxOpenPaperTrades" type="number" min="1" max="100" step="1" defaultValue={settings.maxOpenPaperTrades} />
      </F>
      <F label="Minimum reward / risk (R)" hint="Setups below this are flagged.">
        <input name="minRewardRisk" type="number" min="0.5" max="10" step="0.1" defaultValue={settings.minRewardRisk} />
      </F>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save risk rules"}
        </button>
        {state.message && (
          <span role="status" className={`text-sm ${state.ok ? "text-bull" : "text-bear"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
