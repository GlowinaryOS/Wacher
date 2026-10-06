"use client";

import { useState } from "react";
import type { Timeframe } from "@/lib/domain/types";
import { TV_INTERVALS } from "@/lib/providers/tradingview/symbols";
import { TradingViewWidget, useTradingViewTheme } from "./TradingViewWidget";

const CHART_TIMEFRAMES: Timeframe[] = ["15M", "1H", "4H", "1D", "1W"];

/**
 * Large interactive chart using TradingView's official Advanced Chart widget.
 * Candles, volume, indicators, drawing tools and fullscreen are native to the
 * widget; Watcher only supplies the initial configuration.
 */
export function TradingViewAdvancedChart({
  symbol,
  defaultTimeframe = "1D",
}: {
  symbol: string;
  defaultTimeframe?: Timeframe;
}) {
  const theme = useTradingViewTheme();
  const [tf, setTf] = useState<Timeframe>(defaultTimeframe);

  const config = {
    autosize: true,
    symbol,
    interval: TV_INTERVALS[tf],
    timezone: "Etc/UTC",
    theme,
    style: "1", // candlesticks
    locale: "en",
    allow_symbol_change: true,
    hide_side_toolbar: false, // drawing tools
    hide_top_toolbar: false,
    hide_volume: false,
    withdateranges: true,
    details: false,
    calendar: false,
    save_image: true,
    studies: ["STD;RSI", "STD;MACD"],
    support_host: "https://www.tradingview.com",
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Chart timeframe" className="flex gap-1">
          {CHART_TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTf(t)}
              aria-pressed={tf === t}
              className={`num rounded px-2 py-1 text-xs ${
                tf === t ? "bg-accent text-white" : "bg-panel-2 text-muted hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-faint">
          {symbol} · visual chart by TradingView — Watcher does not read values from it
        </span>
      </div>
      <TradingViewWidget
        widget="advanced-chart"
        config={config}
        label={`TradingView chart for ${symbol}`}
        className="h-[460px] w-full overflow-hidden rounded-md border border-border sm:h-[560px] lg:h-[640px]"
      />
    </div>
  );
}

/** TradingView's official Symbol Info widget: its own last price and daily change. */
export function TradingViewSymbolInfo({ symbol }: { symbol: string }) {
  const theme = useTradingViewTheme();
  return (
    <TradingViewWidget
      widget="symbol-info"
      label={`TradingView symbol info for ${symbol}`}
      config={{ symbol, width: "100%", locale: "en", colorTheme: theme, isTransparent: true }}
      className="min-h-[110px] w-full"
    />
  );
}
