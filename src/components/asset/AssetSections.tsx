import type { ReactNode } from "react";
import { Badge, biasTone, decisionTone, Empty, MockBadge, Notice, Panel, Stat } from "@/components/ui/primitives";
import type { Analysis, NewsItem, Quote, RiskSettings, Scenario, SentimentItem, TechnicalSummary } from "@/lib/domain/types";
import { fmtNum, fmtPct, fmtPrice, fmtTime } from "@/lib/format";
import type { SizingResult } from "@/lib/risk/position-sizing";
import type { ProviderState } from "@/lib/services/research";

// ---------------------------------------------------------------------------
// Header quote (machine-readable data from the market-data provider)
// ---------------------------------------------------------------------------

export function ProviderQuote({ quote, currency, providers }: { quote: Quote | null; currency: string; providers: ProviderState }) {
  if (!quote) {
    return (
      <div className="text-sm text-faint">
        No machine-readable quote — market-data provider: <span className="text-muted">{providers.marketData.label}</span>
      </div>
    );
  }
  const tone = quote.change24hPct > 0 ? "text-bull" : quote.change24hPct < 0 ? "text-bear" : "text-muted";
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
          Watcher data {quote.isMock && <MockBadge label="Synthetic" />}
        </div>
        <div className="num text-2xl font-semibold text-text">{fmtPrice(quote.price)}</div>
      </div>
      <Stat label="24h" value={<span className={tone}>{fmtPct(quote.change24hPct)}</span>} />
      <Stat label="Market" value={quote.marketStatus} />
      <Stat label="Data as of" value={fmtTime(quote.asOf)} hint={`${quote.provider} · ${currency}`} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Market structure & multi-timeframe
// ---------------------------------------------------------------------------

export function MarketStructurePanel({ technicals, isMock }: { technicals: TechnicalSummary | null; isMock: boolean }) {
  if (!technicals) {
    return (
      <Panel title="Market structure">
        <Empty>No candle data available — structure cannot be assessed.</Empty>
      </Panel>
    );
  }
  const d1 = technicals.timeframes.find((t) => t.timeframe === "1D") ?? technicals.timeframes[0];
  return (
    <Panel
      title="Market structure"
      subtitle={`Computed by Watcher from ${d1.timeframe} candles`}
      right={isMock ? <MockBadge label="Synthetic" /> : null}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Stat label="Trend" value={<Badge tone={biasTone(d1.trend)}>{d1.trend}</Badge>} />
        <Stat label="Structure" value={<Badge tone={biasTone(d1.structure)}>{d1.structure.replace("_", " / ")}</Badge>} />
        <Stat label="Momentum (RSI14)" value={fmtNum(d1.rsi14, 1)} hint={d1.macd ? `MACD hist ${fmtNum(d1.macd.histogram, 4)}` : undefined} />
        <Stat label="Volatility (ATR14)" value={fmtPrice(d1.atr14)} hint={d1.atrPct !== null ? `${d1.atrPct.toFixed(2)}% of price` : undefined} />
        <Stat label="Volume vs 20-avg" value={d1.volumeVsAvg20 !== null ? `${d1.volumeVsAvg20.toFixed(2)}×` : "—"} />
        <Stat label="SMA 50 / 200" value={`${fmtPrice(d1.sma50)} / ${fmtPrice(d1.sma200)}`} />
        <Stat label="Support" value={<span className="text-bull">{fmtPrice(d1.support)}</span>} />
        <Stat label="Resistance" value={<span className="text-bear">{fmtPrice(d1.resistance)}</span>} />
      </div>
      {technicals.keyLevels.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">Key levels</div>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {technicals.keyLevels.map((k) => (
              <li key={`${k.label}-${k.price}`} className="flex justify-between rounded bg-panel-2 px-2 py-1 text-xs">
                <span className="text-muted">{k.label}</span>
                <span className="num text-text">{fmtPrice(k.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d1.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-faint">
          {d1.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function TimeframePanel({ technicals }: { technicals: TechnicalSummary | null }) {
  return (
    <Panel
      title="Multi-timeframe analysis"
      right={
        technicals ? (
          technicals.conflict ? (
            <Badge tone="warn">Timeframes conflict</Badge>
          ) : (
            <Badge tone={biasTone(technicals.alignment)}>Alignment: {technicals.alignment}</Badge>
          )
        ) : null
      }
    >
      {!technicals ? (
        <Empty>No timeframe data available.</Empty>
      ) : (
        <>
          {technicals.conflict && (
            <div className="mb-3">
              <Notice title="TIMEFRAMES CONFLICT">
                {technicals.timeframes.map((t) => `${t.timeframe} = ${t.bias.toLowerCase()}`).join(" · ")}. This is not a
                clear directional signal.
              </Notice>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] tracking-[0.12em] text-faint uppercase">
                  <th className="pr-2 pb-1.5 font-semibold">TF</th>
                  <th className="pr-2 pb-1.5 font-semibold">Bias</th>
                  <th className="pr-2 pb-1.5 font-semibold">Structure</th>
                  <th className="pr-2 pb-1.5 font-semibold">Trend</th>
                  <th className="pr-2 pb-1.5 text-right font-semibold">RSI</th>
                  <th className="pr-2 pb-1.5 text-right font-semibold">Support</th>
                  <th className="pb-1.5 text-right font-semibold">Resist.</th>
                </tr>
              </thead>
              <tbody>
                {technicals.timeframes.map((t) => (
                  <tr key={t.timeframe} className="border-t border-border">
                    <td className="num py-1.5 pr-2 font-semibold text-text">{t.timeframe}</td>
                    <td className="py-1.5 pr-2">
                      <Badge tone={biasTone(t.bias)}>{t.bias}</Badge>
                    </td>
                    <td className="py-1.5 pr-2 text-muted">{t.structure.replace("_", "/")}</td>
                    <td className="py-1.5 pr-2 text-muted">{t.trend}</td>
                    <td className="num py-1.5 pr-2 text-right">{fmtNum(t.rsi14, 1)}</td>
                    <td className="num py-1.5 pr-2 text-right text-bull">{fmtPrice(t.support)}</td>
                    <td className="num py-1.5 text-right text-bear">{fmtPrice(t.resistance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-faint">
            Bias requires price structure and trend to agree. Indicators alone never produce a signal.
          </p>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// News & sentiment
// ---------------------------------------------------------------------------

export function NewsPanel({ items, providerLabel, configured }: { items: NewsItem[]; providerLabel: string; configured: boolean }) {
  return (
    <Panel title="News" subtitle={`Provider: ${providerLabel}`}>
      {!configured ? (
        <Empty>No news provider configured. Watcher does not show placeholder headlines.</Empty>
      ) : items.length === 0 ? (
        <Empty>No recent news returned by the provider.</Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.url}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-sm text-text hover:text-accent">
                {n.title}
              </a>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-faint">
                <span>{n.source}</span>
                <span>{fmtTime(n.publishedAt)}</span>
                <Badge tone={n.importance === "HIGH" ? "warn" : "muted"}>{n.importance}</Badge>
                <Badge tone={n.sentiment === "POSITIVE" ? "bull" : n.sentiment === "NEGATIVE" ? "bear" : "neutral"}>{n.sentiment}</Badge>
              </div>
              {n.summary && <p className="mt-1 text-xs text-muted">{n.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function SentimentPanel({ items, providerLabel, configured }: { items: SentimentItem[]; providerLabel: string; configured: boolean }) {
  return (
    <Panel title="Sentiment" subtitle="Supporting evidence only — never treated as fact">
      {!configured ? (
        <Empty>No sentiment provider configured ({providerLabel}).</Empty>
      ) : items.length === 0 ? (
        <Empty>No recent public discussion returned.</Empty>
      ) : (
        <ul className="space-y-2">
          {items.map((s, i) => (
            <li key={`${s.source}-${s.timestamp}-${i}`} className="text-xs">
              <div className="flex flex-wrap items-center gap-2 text-faint">
                <span className="text-muted">{s.community || s.source}</span>
                <span>{fmtTime(s.timestamp)}</span>
                <Badge tone={s.sentiment === "POSITIVE" ? "bull" : s.sentiment === "NEGATIVE" ? "bear" : "neutral"}>{s.sentiment}</Badge>
              </div>
              <p className="mt-0.5 text-muted">{s.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Watcher analysis
// ---------------------------------------------------------------------------

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">{label}</div>
      <div className="text-sm text-text">{children}</div>
    </div>
  );
}

export function AnalysisPanel({ analysis, providerLabel }: { analysis: Analysis | null; providerLabel: string }) {
  if (!analysis) {
    return (
      <Panel title="Watcher analysis">
        <Empty>No analysis available. Analysis provider: {providerLabel}.</Empty>
      </Panel>
    );
  }
  const m = analysis.meta;
  return (
    <Panel
      title="Watcher analysis"
      subtitle={`${m.modelName} v${m.modelVersion} · prompt ${m.promptVersion} · ${m.analysisVersion} · data ${fmtTime(m.dataTimestamp)}`}
      right={
        <>
          {m.isMock && <MockBadge label="Mock analysis — not real" />}
          <Badge tone={decisionTone(analysis.decision)}>{analysis.decision.replace("_", " ")}</Badge>
        </>
      }
    >
      <div className="space-y-4">
        <Section label="Current view">
          <p>{analysis.currentView}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={biasTone(analysis.thesisBias)}>Thesis: {analysis.thesisBias}</Badge>
            {analysis.timeframesConflict && <Badge tone="warn">Timeframes conflict</Badge>}
          </div>
        </Section>
        <div className="grid gap-4 md:grid-cols-2">
          <Section label="Facts (data)">
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted">
              {analysis.facts.map((f) => (
                <li key={f} className="num">{f}</li>
              ))}
            </ul>
          </Section>
          <Section label="Interpretation">
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted">
              {analysis.interpretation.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Section>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Section label="Invalidation">{analysis.invalidation}</Section>
          <Section label="Risk">{analysis.risk}</Section>
        </div>
        <Section label="Decision">
          <span className="font-medium">{analysis.decision.replace("_", " ")}</span> — {analysis.decisionReason}
        </Section>
        {analysis.missingInformation.length > 0 && (
          <Section label="Missing information">
            <div className="flex flex-wrap gap-1">
              {analysis.missingInformation.map((x) => (
                <Badge key={x}>{x}</Badge>
              ))}
            </div>
          </Section>
        )}
      </div>
    </Panel>
  );
}

function ScenarioCard({ name, s, tone }: { name: string; s: Scenario; tone: "bull" | "neutral" | "bear" }) {
  const bar = { bull: "bg-bull", neutral: "bg-neutral", bear: "bg-bear" }[tone];
  const text = { bull: "text-bull", neutral: "text-neutral", bear: "text-bear" }[tone];
  return (
    <div className="rounded-md border border-border bg-panel-2 p-3">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold tracking-[0.12em] uppercase ${text}`}>{name}</span>
        <span className="num text-sm text-text">{s.probability}%</span>
      </div>
      <div className="mt-1.5 h-1 w-full rounded bg-border">
        <div className={`h-1 rounded ${bar}`} style={{ width: `${s.probability}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">{s.reasoning}</p>
      {s.levels.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {s.levels.map((l) => (
            <li key={l.label} className="flex justify-between">
              <span className="text-faint">{l.label}</span>
              <span className="num">{fmtPrice(l.price)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-2 space-y-1 text-[11px]">
        <div>
          <dt className="inline text-faint">Catalysts: </dt>
          <dd className="inline text-muted">{s.catalysts.join("; ") || "—"}</dd>
        </div>
        <div>
          <dt className="inline text-faint">Invalidation: </dt>
          <dd className="inline text-muted">{s.invalidation}</dd>
        </div>
        <div>
          <dt className="inline text-faint">Timeframe: </dt>
          <dd className="inline text-muted">{s.timeframe}</dd>
        </div>
      </dl>
    </div>
  );
}

export function ScenariosPanel({ analysis }: { analysis: Analysis | null }) {
  if (!analysis) return null;
  const { bull, base, bear } = analysis.scenarios;
  return (
    <Panel title="Scenarios" subtitle="Probabilities are estimates, not guarantees" right={analysis.meta.isMock ? <MockBadge /> : null}>
      <div className="grid gap-3 md:grid-cols-3">
        <ScenarioCard name="Bull" s={bull} tone="bull" />
        <ScenarioCard name="Base" s={base} tone="neutral" />
        <ScenarioCard name="Bear" s={bear} tone="bear" />
      </div>
    </Panel>
  );
}

export function SelfChallengePanel({ analysis }: { analysis: Analysis | null }) {
  if (!analysis) return null;
  return (
    <Panel title="Self-challenge" subtitle="Mandatory counter-argument to reduce confirmation bias">
      <div className="space-y-3">
        <Section label="Strongest counter-argument">{analysis.strongestCounterArgument}</Section>
        <Section label="What would change my mind?">
          <ul className="list-disc space-y-0.5 pl-4">
            {analysis.whatWouldChangeMyMind.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Section>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Trade plan
// ---------------------------------------------------------------------------

export function TradePlanPanel({
  analysis,
  sizing,
  risk,
  currency,
}: {
  analysis: Analysis | null;
  sizing: SizingResult | null;
  risk: RiskSettings;
  currency: string;
}) {
  if (!analysis) return null;
  const setup = analysis.setup;
  if (!setup) {
    return (
      <Panel title="Trade plan" right={<Badge tone={decisionTone(analysis.decision)}>{analysis.decision.replace("_", " ")}</Badge>}>
        <div className="rounded-md border border-border bg-panel-2 px-4 py-5 text-center">
          <div className="text-lg font-semibold tracking-[0.2em] text-text">NO TRADE</div>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted">{analysis.decisionReason}</p>
          <p className="mt-2 text-[11px] text-faint">Standing aside is a valid, respected result.</p>
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      title="Trade plan (hypothetical)"
      subtitle="Research output only. Watcher never places orders — you decide and execute manually."
      right={
        <>
          {analysis.meta.isMock && <MockBadge label="Mock setup" />}
          <Badge tone={biasTone(setup.direction)}>{setup.direction}</Badge>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="Entry zone" value={`${fmtPrice(setup.entryLow)} – ${fmtPrice(setup.entryHigh)}`} />
        <Stat label="Stop / invalidation" value={<span className="text-bear">{fmtPrice(setup.stop)}</span>} />
        <Stat label="Target 1" value={<span className="text-bull">{fmtPrice(setup.target1)}</span>} />
        <Stat label="Target 2" value={<span className="text-bull">{fmtPrice(setup.target2)}</span>} />
        <Stat label="Reward / risk" value={sizing ? `${sizing.rewardRiskT1.toFixed(2)}R / ${sizing.rewardRiskT2?.toFixed(2) ?? "—"}R` : "—"} hint="Computed by Watcher" />
        <Stat label="Confidence" value={`${setup.confidence}%`} hint="Uncalibrated until tracked" />
        <Stat label="Timeframe" value={setup.timeframe} />
        <Stat label="Risk per unit" value={fmtPrice(sizing?.riskPerUnit)} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Section label="Reasoning">{setup.reasoning}</Section>
        <Section label="Invalidation condition">{setup.invalidationCondition}</Section>
        <Section label="Catalysts">
          <ul className="list-disc pl-4 text-xs text-muted">
            {setup.catalysts.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Section>
        <Section label="Risks">
          <ul className="list-disc pl-4 text-xs text-muted">
            {setup.risks.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="mt-4 rounded-md border border-border bg-panel-2 p-3">
        <div className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">Risk check against your rules</div>
        {sizing && sizing.positionSizeUnits !== null ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Stat label={`Max risk (${risk.maxRiskPerTradePct}%)`} value={`${fmtNum(sizing.maxRiskAmount)} ${risk.accountCurrency}`} />
            <Stat label="Position size" value={`${fmtNum(sizing.positionSizeUnits, 6)} units`} />
            <Stat label="Notional" value={`${fmtNum(sizing.positionNotional)} ${currency}`} />
            <Stat label="Loss at stop / gain at T1" value={`${fmtNum(sizing.potentialLoss)} / ${fmtNum(sizing.potentialRewardT1)}`} />
          </div>
        ) : (
          <p className="text-xs text-faint">Set an account size in Settings to see hypothetical position sizing from your own risk rules.</p>
        )}
        {sizing && sizing.violations.length > 0 && (
          <div className="mt-3 space-y-1">
            {sizing.violations.map((v) => (
              <Notice key={v} tone="bear" title="Rule warning">
                {v}
              </Notice>
            ))}
          </div>
        )}
        {risk.accountSize && risk.accountCurrency !== currency && (
          <div className="mt-3">
            <Notice tone="warn" title="Currency mismatch">
              Your account is in {risk.accountCurrency} but {currency} prices are used. No FX conversion is applied, so
              sizing is only approximate.
            </Notice>
          </div>
        )}
        <p className="mt-2 text-[11px] text-faint">
          Sizing follows your predefined rules only. Never increase size to recover a loss.
        </p>
      </div>
    </Panel>
  );
}
