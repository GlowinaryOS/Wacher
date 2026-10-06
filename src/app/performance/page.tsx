import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { Badge, Panel } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Performance" };

const SAMPLE_TIERS = [20, 50, 100, 250, 500];
const CONFIDENCE_BUCKETS = ["50–60%", "60–70%", "70–80%", "80–90%", "90–100%"];
const RESOLVED = 0; // populated from prediction_results in Phase 3

export default function PerformancePage() {
  return (
    <PhasePlaceholder
      title="Performance"
      phase={3}
      summary="Honest measurement of whether the Watcher methodology has an edge."
      bullets={[
        "Directional accuracy, target hit rate, invalidation rate, win/loss rate.",
        "Average hypothetical return, average R, average gain and loss, maximum drawdown.",
        "Breakdowns by asset, timeframe, confidence and market regime.",
        "Comparison against a reasonable benchmark (e.g. buy-and-hold over the same windows). If Watcher does not beat it after a sufficient sample, this page says so.",
      ]}
    >
      <Panel title="Sample size" subtitle={`${RESOLVED} resolved predictions`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SAMPLE_TIERS.map((n) => (
            <div key={n} className="rounded-md border border-border bg-panel-2 p-3">
              <div className="num text-sm text-text">Last {n}</div>
              <div className="mt-2">
                {RESOLVED >= n ? <Badge tone="bull">Available</Badge> : <Badge tone="warn">Insufficient sample size</Badge>}
              </div>
              <div className="mt-1 text-[11px] text-faint">{Math.min(RESOLVED, n)} / {n}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">No edge is claimed from a handful of results. Statistics appear only once each tier is filled.</p>
      </Panel>
      <Panel title="Confidence calibration" subtitle="Does stated confidence match the observed hit rate?">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] tracking-[0.12em] text-faint uppercase">
              <th className="pb-2 font-semibold">Stated confidence</th>
              <th className="pb-2 font-semibold">Predictions</th>
              <th className="pb-2 font-semibold">Actual success rate</th>
            </tr>
          </thead>
          <tbody>
            {CONFIDENCE_BUCKETS.map((b) => (
              <tr key={b} className="border-t border-border">
                <td className="num py-2">{b}</td>
                <td className="num py-2 text-muted">0</td>
                <td className="py-2"><Badge tone="warn">Insufficient sample size</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-faint">Confidence is treated as uncalibrated until the data shows otherwise.</p>
      </Panel>
    </PhasePlaceholder>
  );
}
