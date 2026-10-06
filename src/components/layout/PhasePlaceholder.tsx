import type { ReactNode } from "react";
import { Badge, PageHeader, Panel } from "@/components/ui/primitives";

export function PhasePlaceholder({
  title,
  phase,
  summary,
  bullets,
  children,
}: {
  title: string;
  phase: number;
  summary: string;
  bullets: string[];
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={summary} right={<Badge tone="accent">Phase {phase}</Badge>} />
      <div className="space-y-4">
        {children}
        <Panel title="What will live here">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
