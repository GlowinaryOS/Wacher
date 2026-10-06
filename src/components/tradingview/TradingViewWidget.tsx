"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Renders one of TradingView's official embeddable widgets exactly as the
 * published embed snippet does: a `.tradingview-widget-container` holding a
 * `__widget` div, the attribution link, and a <script> from TradingView's CDN
 * whose text content is the JSON config. No TradingView code is vendored.
 *
 * The widget is a cross-origin iframe. Watcher cannot read prices, indicators
 * or drawings from it — it is the visual layer only.
 */

const EMBED_BASE = "https://s3.tradingview.com/external-embedding/";

function subscribeScheme(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Follows the OS colour scheme so the chart matches the rest of the terminal. */
export function useTradingViewTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribeScheme,
    () => (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
    () => "dark",
  );
}

export function TradingViewWidget({
  widget,
  config,
  className = "",
  height,
  label,
}: {
  /** Widget script name, e.g. "advanced-chart" or "symbol-info". */
  widget: "advanced-chart" | "symbol-info";
  config: Record<string, unknown>;
  className?: string;
  height?: number | string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const configJson = JSON.stringify(config);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.replaceChildren();

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    container.style.width = "100%";

    const target = document.createElement("div");
    target.className = "tradingview-widget-container__widget";
    target.style.height = "calc(100% - 24px)";
    target.style.width = "100%";

    const copyright = document.createElement("div");
    copyright.className = "tradingview-widget-copyright";
    copyright.style.cssText = "font-size:11px;line-height:24px;text-align:right;";
    const link = document.createElement("a");
    link.href = "https://www.tradingview.com/";
    link.rel = "noopener nofollow";
    link.target = "_blank";
    link.textContent = "Chart by TradingView";
    link.style.color = "var(--faint)";
    copyright.appendChild(link);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = `${EMBED_BASE}embed-widget-${widget}.js`;
    script.async = true;
    script.innerHTML = configJson;

    container.append(target, copyright, script);
    host.appendChild(container);

    return () => {
      host.replaceChildren();
    };
  }, [widget, configJson]);

  return <div ref={ref} aria-label={label} className={className} style={{ height }} />;
}
