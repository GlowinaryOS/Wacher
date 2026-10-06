import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { Empty, Panel } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Predictions" };

export default function PredictionsPage() {
  return (
    <PhasePlaceholder
      title="Prediction ledger"
      phase={3}
      summary="Every prediction, permanently recorded and never edited after the fact."
      bullets={[
        "Immutable records: entry zone, invalidation, targets, timeframe, confidence, Bull/Base/Bear probabilities, thesis and strongest counter-argument.",
        "A locked, hashed snapshot of the market data, news, analysis, model and prompt version at creation time (forward testing, no hindsight).",
        "Status history: OPEN → TARGET_1_HIT / TARGET_2_HIT / STOPPED_OUT / INVALIDATED / EXPIRED / CANCELLED, plus NO_TRADE records.",
        "Automatic resolution from candles in chronological order, with actual return and R multiple.",
        "The database itself rejects updates and deletes on predictions (see supabase/migrations).",
      ]}
    >
      <Panel title="Ledger">
        <Empty>No predictions recorded yet.</Empty>
      </Panel>
    </PhasePlaceholder>
  );
}
