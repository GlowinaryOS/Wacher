import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/layout/PhasePlaceholder";
import { Empty, Panel } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Journal" };

export default function JournalPage() {
  return (
    <PhasePlaceholder
      title="Journal"
      phase={4}
      summary="Your decisions, kept separate from Watcher's predictions."
      bullets={[
        "Reason for entry and exit, the platform you used, fills and fees — recorded by you.",
        "Whether you followed Watcher, disagreed with it, or traded when it said NO TRADE.",
        "Emotional state, mistakes and lessons.",
        "Watcher vs User analysis: separate WATCHER THESIS, USER DECISION, ACTUAL TRADE and ACTUAL RESULT, to tell analysis errors from execution, risk or emotional errors.",
      ]}
    >
      <Panel title="Entries">
        <Empty>No journal entries yet.</Empty>
      </Panel>
    </PhasePlaceholder>
  );
}
