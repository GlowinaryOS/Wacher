import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
  id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`min-w-0 rounded-lg border border-border bg-panel break-words ${className}`}>
      {(title || right) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-faint">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

type Tone = "bull" | "bear" | "neutral" | "warn" | "mock" | "accent" | "muted";

const toneClass: Record<Tone, string> = {
  bull: "text-bull border-bull/40 bg-bull/10",
  bear: "text-bear border-bear/40 bg-bear/10",
  neutral: "text-neutral border-neutral/40 bg-neutral/10",
  warn: "text-warn border-warn/40 bg-warn/10",
  mock: "text-mock border-mock/40 bg-mock/10",
  accent: "text-accent border-accent/40 bg-accent/10",
  muted: "text-muted border-border bg-panel-2",
};

export function Badge({ tone = "muted", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider whitespace-nowrap uppercase ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export function biasTone(b: string | null | undefined): Tone {
  if (b === "BULLISH" || b === "LONG" || b === "UP" || b === "HH_HL") return "bull";
  if (b === "BEARISH" || b === "SHORT" || b === "DOWN" || b === "LH_LL") return "bear";
  if (b === "CONFLICT" || b === "UNCLEAR") return "warn";
  return "neutral";
}

export function decisionTone(d: string): Tone {
  if (d === "TRADE") return "accent";
  if (d === "WATCH") return "neutral";
  return "muted";
}

export function MockBadge({ label = "Mock" }: { label?: string }) {
  return (
    <Badge tone="mock" title="Development placeholder — not real market data or analysis">
      {label}
    </Badge>
  );
}

export function Notice({ tone = "warn", title, children }: { tone?: Tone; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${toneClass[tone]}`}>
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-0.5 text-xs opacity-90">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-faint">{children}</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">{label}</div>
      <div className="num mt-0.5 truncate text-sm text-text">{value}</div>
      {hint && <div className="text-[11px] text-faint">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg border border-border bg-panel ${className}`} />;
}
