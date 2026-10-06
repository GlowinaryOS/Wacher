import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { Empty, Notice, Panel } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Paper Trades" };

export default function PaperTradesPage() {
  return (
    <PhasePlaceholder
      title="Paper trades"
      phase={4}
      summary="Hypothetical trades derived from predictions. Never sent to any broker."
      bullets={[
        "Turn a prediction into a paper trade sized by your own risk rules.",
        "Fields: asset, direction, entry, stop, target, risk, position size, opened/closed, P/L, R multiple, reason, linked prediction.",
        "Enforces your max open paper trades and max daily loss.",
        "Opening terms are locked once opened (enforced in the database).",
      ]}
    >
      <Notice tone="accent" title="Paper trading never places a real order.">
        Watcher has no broker connection. Real trades are placed by you on your own platform.
      </Notice>
      <Panel title="Open & closed paper trades">
        <Empty>No paper trades yet.</Empty>
      </Panel>
    </PhasePlaceholder>
  );
}
