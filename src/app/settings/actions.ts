"use server";

import { refresh } from "next/cache";
import { RiskSettingsSchema } from "@/lib/domain/types";
import { getRepository } from "@/lib/repositories";

export interface RiskFormState {
  ok: boolean;
  message: string | null;
}

function num(fd: FormData, key: string): number {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
}

export async function saveRiskSettings(_prev: RiskFormState, fd: FormData): Promise<RiskFormState> {
  const rawAccount = fd.get("accountSize");
  const parsed = RiskSettingsSchema.safeParse({
    accountSize: typeof rawAccount === "string" && rawAccount.trim() !== "" ? Number(rawAccount) : null,
    accountCurrency: fd.get("accountCurrency"),
    maxRiskPerTradePct: num(fd, "maxRiskPerTradePct"),
    maxDailyLossPct: num(fd, "maxDailyLossPct"),
    maxOpenPaperTrades: num(fd, "maxOpenPaperTrades"),
    minRewardRisk: num(fd, "minRewardRisk"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: `${String(first.path[0] ?? "Input")}: ${first.message}` };
  }
  await getRepository().saveRiskSettings(parsed.data);
  refresh();
  return { ok: true, message: "Risk rules saved." };
}
