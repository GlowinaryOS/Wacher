# WATCHER — Architecture & Phase 1 Plan

> Watcher is a private **research and decision-support system**.
> It never places, routes, or simulates real orders against a broker.
> The user makes every real-money decision and executes it manually on
> their own platforms (Coinbase, Trading 212, …). Watcher has no broker
> credentials and no code path that could trade.

This document answers the "First Task" checklist from the master
specification (§32). It is the reference for every later phase.

---

## 1. Repository inspection (starting point)

At the start of Phase 1 the repository contained only a one-line
`README.md` and an initial commit. There was no existing code, schema or
configuration to preserve, so Phase 1 starts from a clean Next.js
scaffold.

---

## 2. Proposed architecture

Watcher is a single Next.js (App Router, TypeScript, Tailwind) application
with a strict layer split. Everything that touches a secret or an external
API runs **server-side only**.

```
┌──────────────────────────────── Browser ────────────────────────────────┐
│  React UI (server components + small client islands)                     │
│  • TradingView embedded widgets  (visual only, loaded from tradingview)  │
│  • Forms → Server Actions        (no API keys ever reach the browser)    │
└──────────────────────────────────────┬───────────────────────────────────┘
                                       │ RSC / Server Actions
┌──────────────────────────────────────▼───────────────────────────────────┐
│ Next.js server                                                           │
│                                                                          │
│  app/ (routes, pages, server actions)                                    │
│        │                                                                 │
│  lib/services/   orchestration (asset research, daily watch [P2], …)     │
│        │                                                                 │
│  ┌─────┴────────────┬──────────────┬───────────────┬─────────────────┐   │
│  │ Providers        │ Technical    │ Risk engine   │ Repositories    │   │
│  │ (interfaces)     │ engine       │ (pure fns)    │ (persistence)   │   │
│  │ • market-data    │ indicators,  │ position size │ • local JSON    │   │
│  │ • news           │ structure,   │ R/R, rule     │   (dev)         │   │
│  │ • sentiment      │ multi-TF     │ violations    │ • Supabase      │   │
│  │ • analysis(LLM)  │ (pure fns)   │               │   (Postgres)    │   │
│  │ • tradingview    │              │               │                 │   │
│  │   (config only)  │              │               │                 │   │
│  └─────┬────────────┴──────────────┴───────────────┴─────────────────┘   │
└────────┼─────────────────────────────────────────────────────────────────┘
         │ HTTPS, server-side, keys from env
         ▼
  Market-data API · News API · Sentiment sources · Claude API · Supabase
```

Design rules:

1. **Provider interfaces, not providers.** Every external dependency sits
   behind a TypeScript interface in `src/lib/providers/<kind>/types.ts`.
   A registry (`index.ts`) picks the implementation from env vars.
   Swapping Alpha Vantage for Polygon, or adding a second news source,
   must not touch UI or services.
2. **Validation at the boundary.** Every external payload (market data,
   news, LLM output) is parsed with `zod` before it enters the domain.
   Invalid data is rejected and surfaced as "unavailable", never patched.
3. **Pure computation is separate from I/O.** Indicators, market
   structure, risk sizing and performance statistics are pure functions
   with unit tests. They never fetch.
4. **Append-only history.** Analyses, snapshots and predictions are
   inserted, never updated. Status changes are new event rows.
5. **Explicit data provenance.** Every value shown in the UI carries its
   source (`provider`, `asOf`, `isMock`). Mock data is visually labelled.
6. **"Unavailable" beats "invented".** If a provider is not configured
   or fails, the UI says so. No fallback to fabricated numbers.

---

## 3. Complete data flow

### 3.1 Asset page (Phase 1 → 2)

```
/asset/BTC
  ├─ Repository.getAssetBySymbol("BTC")                  → asset config
  ├─ TradingView widget  ← tradingViewSymbol (e.g. COINBASE:BTCUSD)
  │     (browser loads TradingView's script; Watcher reads nothing back)
  ├─ MarketDataProvider.getQuote(asset)                  → price, 24h change
  ├─ MarketDataProvider.getCandles(asset, tf) for each TF → OHLCV
  │     └─ technical engine (pure) → structure, trend, RSI, MACD, ATR,
  │                                   swing levels, per-TF bias
  ├─ NewsProvider.getNews(asset)                         → NewsItem[]
  ├─ SentimentProvider.getSentiment(asset)               → SentimentItem[]
  └─ AnalysisProvider.analyse(AnalysisInput)             → Analysis
        (input = asset + quote + technical summary per TF + news +
         sentiment + regime + previous analysis; output validated by zod)
```

### 3.2 Daily Watch (Phase 2)

```
RUN DAILY WATCH  (server action, user-triggered only)
 1  load active watchlist assets
 2  market regime: fetch index/benchmark candles (SPY/QQQ/VIX/DXY/US10Y,
    BTC/ETH, BTC dominance if provider supports it) → technical engine →
    AnalysisProvider.classifyRegime()   (UNCLEAR if inputs missing)
 3  per asset (bounded concurrency):
      quote + multi-TF candles → technical summary
      news + sentiment
      previous analysis + open predictions for the asset
      AnalysisProvider.analyse() → Analysis (scenarios, self-challenge,
                                     TRADE / WATCH / NO_TRADE)
      INSERT market_snapshots, analyses           (append-only)
 4  diff vs previous analyses → "what changed"
 5  open predictions: evaluate against latest candles → prediction_events
 6  new predictions only when analysis.decision = TRADE and the setup
    passes deterministic gates (R/R ≥ threshold, timeframes not in
    conflict, risk rules satisfied) → INSERT predictions (locked snapshot)
 7  compose daily_reports row (structured JSON + rendered markdown)
```

Nothing in this flow can place an order. The output is a report and
database rows.

### 3.3 Prediction lifecycle (Phase 3)

```
analysis (TRADE) ──► prediction (immutable, snapshot locked, status OPEN)
                          │
         resolver job (on Daily Watch or manual "Evaluate now")
         reads candles since created_at, checks entry fill, stop,
         T1, T2, expiry in chronological order
                          │
                          ▼
                 prediction_events  (OPEN→TARGET_1_HIT→TARGET_2_HIT …)
                 prediction_results (final: result, actual_return, R)
                          │
                          ▼
             performance + calibration views (pure statistics)
```

### 3.4 Watcher vs User (Phase 4)

`predictions` (what Watcher said) → `user_decisions` (what the user chose:
followed / ignored / traded against / traded with no Watcher signal) →
`journal_entries` (the user's actual trade, emotions, lessons). The three
are separate tables joined by ids, so "Watcher right, user didn't act"
and "Watcher said NO TRADE, user traded anyway" are queryable.

---

## 4. Folder structure

```
.
├─ docs/
│  └─ ARCHITECTURE.md            ← this file
├─ supabase/
│  └─ migrations/
│     └─ 0001_initial_schema.sql ← full Postgres schema, RLS, immutability
├─ src/
│  ├─ proxy.ts                   ← optional HTTP Basic Auth gate (private app)
│  ├─ app/                       ← routes (App Router)
│  │  ├─ layout.tsx              ← shell + navigation
│  │  ├─ page.tsx                ← Dashboard
│  │  ├─ watchlist/              ← watchlist management (server actions)
│  │  ├─ asset/[symbol]/         ← asset research page
│  │  ├─ predictions/            ← ledger            (Phase 3)
│  │  ├─ paper-trades/           ← paper trading     (Phase 4)
│  │  ├─ performance/            ← stats/calibration (Phase 3)
│  │  ├─ journal/                ← journal           (Phase 4)
│  │  └─ settings/               ← risk rules, provider status
│  ├─ components/
│  │  ├─ layout/                 ← nav, page header
│  │  ├─ tradingview/            ← official embed wrappers (client)
│  │  ├─ asset/                  ← asset page sections
│  │  ├─ watchlist/              ← table + forms
│  │  └─ ui/                     ← cards, badges, provenance labels
│  └─ lib/
│     ├─ config/env.ts           ← server-only env parsing & provider choice
│     ├─ domain/                 ← types + zod schemas (Asset, Analysis, …)
│     ├─ providers/
│     │  ├─ market-data/         ← interface, mock (synthetic), none
│     │  ├─ news/                ← interface, none
│     │  ├─ sentiment/           ← interface, none
│     │  ├─ analysis/            ← interface, mock (rule-based), [claude P2]
│     │  └─ tradingview/         ← symbol mapping + widget config builder
│     ├─ technical/              ← indicators & market structure (pure)
│     ├─ risk/                   ← position sizing & rule checks (pure)
│     ├─ repositories/           ← persistence interface, local + supabase
│     └─ services/               ← orchestration used by pages
├─ .env.example
└─ package.json
```

---

## 5. Supabase / PostgreSQL schema

Full DDL: `supabase/migrations/0001_initial_schema.sql`. Summary:

| Table | Purpose | Mutability |
|---|---|---|
| `users` | Profile row keyed to `auth.users.id` | updatable |
| `risk_settings` | Max risk/trade, max daily loss, max open paper trades, account size for sizing | updatable (one row per user) |
| `watchlists` | Named watchlists per user | updatable |
| `assets` | Instrument: symbol, name, asset_type (CRYPTO/STOCK/ETF), exchange, currency, `tradingview_symbol`, `provider_symbol` | updatable (identity is the uuid; history stores symbol snapshots) |
| `watchlist_assets` | Membership: notes, `is_active`, position | updatable |
| `model_versions` | provider, model name, model version | insert-only |
| `prompt_versions` | prompt key, version, content hash, template text | insert-only |
| `market_snapshots` | Quote + OHLCV summary + technical summary per asset/time, provider, `is_mock` | **append-only** |
| `news_items` | source, title, url, published_at, asset, summary, importance, sentiment, provider | append-only (dedupe on url) |
| `sentiment_items` | source, author/community, timestamp, sentiment, summary, relevance | append-only |
| `daily_watch_runs` | One row per Daily Watch run: started/finished, status, regime | append-only (status row finalised once) |
| `market_regimes` | Per run & market (CRYPTO/STOCKS): BULLISH/NEUTRAL/BEARISH/UNCLEAR + reasoning + inputs | append-only |
| `analyses` | Full structured analysis JSON, decision, timeframe biases, conflict flag, model/prompt/analysis version, data timestamp | **append-only** |
| `predictions` | Every field from spec §16 + locked `snapshot` JSON (market data, analysis, news, confidence, model, prompt) | **immutable** (trigger blocks UPDATE/DELETE) |
| `prediction_events` | Status transitions with price & time | append-only |
| `prediction_results` | Final resolution: result, resolved_at, actual_return, r_multiple, MAE/MFE | insert-once per prediction |
| `paper_trades` | Hypothetical trade linked to prediction | open → closed only |
| `user_decisions` | User's decision about a prediction (or a trade with no prediction) | append-only |
| `journal_entries` | Entry/exit reasons, followed/disagreed, emotional state, mistakes, lessons | updatable by user (it is *their* journal), never touches Watcher rows |
| `daily_reports` | Structured report JSON + markdown per run | append-only |
| `alerts` | TradingView webhook payloads (Phase 5) | append-only |

Key points:

* Every table has `id uuid`, `created_at timestamptz default now()` and
  `user_id` (for row-level security).
* Foreign keys everywhere (`analyses.asset_id → assets.id`,
  `predictions.analysis_id → analyses.id`, `prediction_results.prediction_id`
  unique, `paper_trades.prediction_id`, …). History tables use
  `on delete restrict` so deleting an asset can't silently erase its record;
  removing from the watchlist only deletes the `watchlist_assets` row.
* `predictions`, `analyses`, `market_snapshots` have triggers that raise
  on `UPDATE`/`DELETE` — the database itself enforces "never overwrite".
* Current prediction status = latest `prediction_events` row (view
  `prediction_status_current`).
* RLS enabled on every table with `user_id = auth.uid()` policies. The
  server uses the service-role key and always scopes by the owner id.

---

## 6. TradingView embedded chart — exact implementation

We use TradingView's **official, free embeddable widgets** (the
"Advanced Real-Time Chart" widget and the "Symbol Info" widget). These are
the documented embed snippets from tradingview.com/widget-docs: a
container `div` plus a `<script>` tag pointing at
`https://s3.tradingview.com/external-embedding/embed-widget-<name>.js`
whose text content is the JSON configuration.

Implementation (`src/components/tradingview/`):

* `TradingViewWidget` — a client component that, inside `useEffect`,
  creates the official container markup
  (`.tradingview-widget-container` → `.tradingview-widget-container__widget`
  + copyright link), appends a `<script>` element with `src` = the
  official embed URL and `innerHTML = JSON.stringify(config)`, and cleans
  up on unmount / config change. No TradingView code is vendored.
* `TradingViewAdvancedChart` — builds the Advanced Chart config:
  `symbol` (from `asset.tradingViewSymbol`, e.g. `COINBASE:BTCUSD`,
  `NASDAQ:NVDA`), `interval` (user-selectable 15 / 60 / 240 / D / W),
  `style: "1"` (candles), `theme: "dark"`, `autosize: true`,
  `allow_symbol_change`, `hide_side_toolbar: false` (drawing tools),
  `studies` (Volume, RSI, MACD as defaults), `withdateranges`,
  `details`, `calendar: false`, `support_host`. Fullscreen and indicator
  menus are native to the widget.
* `TradingViewSymbolInfo` — the official Symbol Info widget for the asset
  header, showing TradingView's own last price and daily change. It is
  labelled "via TradingView" because Watcher cannot read that value.
* The attribution link required by TradingView's widget terms is kept.

**What Watcher can and cannot do with TradingView:**

* The widget is a cross-origin iframe. Watcher **cannot** read prices,
  indicator values or drawings from it, and nothing in the code pretends
  to. It is the visual layer only.
* TradingView's Charting Library / Trading Platform (self-hosted, licence
  required) and any data API are **not** used. If added later they get
  their own provider implementation.
* TradingView alerts → webhooks (Phase 5) are the only planned
  machine-readable channel *from* TradingView, and they carry only what the
  user puts in the alert message.

---

## 7. Information that comes from TradingView

* Interactive chart rendering (candles, volume, timeframes, indicators,
  drawing tools, fullscreen) — **visual, for the user's eyes only**.
* Symbol Info header (last price / change) — visual only.
* (Phase 5) Alert webhook payloads the user configures in TradingView.

Nothing from the TradingView widget is fed to Claude or stored as data.

## 8. Information that must come from a separate market-data provider

Everything machine-readable:

* Latest quote: last price, 24h/1D change, volume, market status/session.
* OHLCV candles per timeframe (15m, 1h, 4h, 1D, 1W).
* Benchmarks for market regime: S&P 500 / Nasdaq (SPY/QQQ or index),
  VIX, US 10Y yield, DXY; BTC, ETH, total crypto market cap and BTC
  dominance (crypto aggregator).
* All technical values (RSI, MACD, MAs, ATR, swing highs/lows, support/
  resistance) are **computed by Watcher** from those candles in
  `src/lib/technical/`, so they are reproducible and stored in snapshots.

Candidate providers (choose in Phase 2; all behind `MarketDataProvider`):
Coinbase Exchange public API or Binance public API (crypto candles, no key
for public data), CoinGecko (crypto market caps/dominance), Alpha Vantage,
Polygon.io, Twelve Data, Financial Modeling Prep (stocks/ETFs/indices),
FRED (yields, rates). Each one's real capabilities are verified against
its docs before implementation.

## 9. Information that comes from news providers

`NewsProvider` returns validated `NewsItem { source, title, url,
publishedAt, assetSymbols, summary, importance, sentiment, provider }`.

Candidates: Finnhub / Polygon / Alpha Vantage news (company news,
earnings), SEC EDGAR (filings), official project blogs / RSS
(crypto announcements), CryptoPanic, and optionally Claude's server-side
`web_search` tool. With web search, URLs and titles are taken **only from
the tool's `web_search_result` blocks**, never from model prose, so a URL
cannot be invented. Items without a source URL and timestamp are shown as
"unverified" or dropped.

Sentiment (`SentimentProvider`): Reddit API (OAuth app, subject to Reddit's
API terms), StockTwits, analyst commentary from news feeds. Always labelled
as supporting evidence, never fact.

---

## 10. How Claude receives structured information

Claude never browses the TradingView iframe and never sees raw API keys.
The server assembles an `AnalysisInput` JSON document:

```jsonc
{
  "asset": { "symbol": "NVDA", "type": "STOCK", "exchange": "NASDAQ", ... },
  "dataTimestamp": "2026-10-06T21:00:00Z",
  "quote": { "price": ..., "change24hPct": ..., "provider": "...", "asOf": "..." },
  "timeframes": {
    "1D": { "trend": "UP", "structure": "HH_HL", "rsi14": 61.2, "macd": {...},
            "atr14": ..., "sma50": ..., "sma200": ..., "swingHighs": [...],
            "swingLows": [...], "volumeVsAvg": 1.3 },
    "4H": { ... }, "1H": { ... }
  },
  "marketRegime": { "classification": "NEUTRAL", "reasoning": "...", "inputs": {...} },
  "news":      [ { "source", "title", "url", "publishedAt", "summary" } ],
  "sentiment": [ { "source", "community", "timestamp", "summary" } ],
  "previousAnalysis": { ... } | null,
  "openPredictions": [ ... ],
  "riskRules": { "maxRiskPerTradePct": 1, ... },
  "missingData": [ "BTC dominance unavailable", ... ]
}
```

Phase 2 implementation (`ClaudeAnalysisProvider`):

* Official `@anthropic-ai/sdk`, server-side only, model from
  `ANTHROPIC_MODEL` (default `claude-opus-5-5`), adaptive thinking,
  explicit `output_config.effort` (Opus 5.5 defaults to `medium`).
* **Structured output** via `output_config.format` (JSON schema generated
  from the same zod schema used to validate the response). The response is
  re-validated with zod; a failure stores nothing and is reported.
* News research with `web_search_20260209` is a **separate call** from the
  structured analysis call (citations and structured output formats don't
  combine). Its results are normalised into `NewsItem`s first.
* A versioned system prompt (`prompt_versions`) states the principles:
  separate facts / interpretation / prediction, never invent values,
  mandatory Bull/Base/Bear with probabilities summing to 100, mandatory
  strongest counter-argument and "what would change my mind", NO TRADE is
  a first-class answer, flag TIMEFRAMES CONFLICT.
* Deterministic post-checks in code (not trusted to the model):
  probabilities sum to 100 ± 1; stop is on the correct side of entry;
  targets beyond entry; R/R computed by Watcher, not copied from the model;
  levels cited must be within a sane distance of the latest price;
  conflicting timeframes cannot yield `TRADE` unless explicitly justified.
* Every analysis row stores `model_name`, `model_version`, `prompt_version`,
  `analysis_version`, `data_timestamp` and the full input document.

---

## 11. External integrations

| Integration | Phase | Purpose | Status in Phase 1 |
|---|---|---|---|
| TradingView embedded widgets | 1 | Visual chart, symbol info | **Live** (no key) |
| Supabase (Postgres + Auth) | 1 | Persistence | Schema ready; app uses it when env vars set, else local JSON store |
| Market-data API (TBD, see §8) | 2 | Quotes, OHLCV, benchmarks | Interface + synthetic mock |
| News API (TBD, see §9) | 2 | News items | Interface, "not configured" |
| Sentiment sources (Reddit etc.) | 2/6 | Public sentiment | Interface, "not configured" |
| Anthropic Claude API | 2 | Reasoning layer | Interface + labelled rule-based mock |
| TradingView alert webhooks | 5 | Event triggers | Planned |
| Broker APIs (Coinbase, Trading 212) | never | — | **Deliberately not integrated** |

## 12. Environment variables

See `.env.example`. Summary:

| Variable | Required | Notes |
|---|---|---|
| `WATCHER_DATA_BACKEND` | no | `local` (default) or `supabase` |
| `WATCHER_LOCAL_DATA_DIR` | no | default `.watcher-data` (gitignored) |
| `NEXT_PUBLIC_SUPABASE_URL` | for Supabase | public project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for Supabase | **server-only** |
| `WATCHER_OWNER_USER_ID` | for Supabase | uuid of the single owner user |
| `WATCHER_BASIC_AUTH_USER` / `WATCHER_BASIC_AUTH_PASSWORD` | recommended when deployed | gate the whole app |
| `MARKET_DATA_PROVIDER` | no | `mock` \| `none` (Phase 2 adds real ones). Defaults to `mock` in dev, `none` in production |
| `WATCHER_ALLOW_MOCK_IN_PRODUCTION` | no | must be `true` to use mock providers in a production build |
| `MARKET_DATA_API_KEY` | Phase 2 | server-only |
| `NEWS_PROVIDER`, `NEWS_API_KEY` | Phase 2 | server-only |
| `SENTIMENT_PROVIDER`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | Phase 2/6 | server-only |
| `ANALYSIS_PROVIDER` | no | `mock` \| `none` (Phase 2 adds `claude`) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Phase 2 | server-only |
| `TRADINGVIEW_WEBHOOK_SECRET` | Phase 5 | shared secret for alert webhooks |

No variable prefixed `NEXT_PUBLIC_` ever holds a secret.

## 13. Initially mocked (clearly labelled)

* **Market data** — `MockMarketDataProvider` generates deterministic
  *synthetic* candles (seeded random walk per symbol). Prices are
  deliberately not realistic for the real instrument, and every surface
  showing them carries a "SYNTHETIC DATA" badge. The technical engine runs
  on these candles exactly as it will on real ones.
* **Analysis** — `MockAnalysisProvider` is a transparent rule-based
  stand-in (not an LLM) that derives scenarios and a TRADE/WATCH/NO TRADE
  decision from the synthetic technical summary, so the UI and data shape
  are exercised end-to-end. Labelled "MOCK ANALYSIS — NOT REAL".
* **Market regime** — reported as `UNCLEAR` with the reason "no real
  market data provider configured". It is not inferred from synthetic data.
* **News / Sentiment** — not mocked. Shown as "No provider configured"
  so no fake headline or URL can ever appear.

Mock providers refuse to run in a production build unless
`WATCHER_ALLOW_MOCK_IN_PRODUCTION=true`.

## 14. What remains manual — permanently

* **All real trade execution.** The user places every real order on
  their own platform. Watcher has no broker integration, by design.
* The final real-money decision and position size.
* Running Daily Watch (user-triggered; scheduling may be added later but
  it still only produces analysis).
* Watchlist curation and risk-rule definition.
* Journal content: emotions, mistakes, lessons, whether Watcher was
  followed.
* Recording actual trades (fills, exits) in the journal.
* Creating TradingView alerts in TradingView (Phase 5).

## 15. Phase 1 implementation plan

1. Scaffold Next.js 16 (App Router, TS, Tailwind 4, ESLint), add `zod`,
   `@supabase/supabase-js`, `vitest`.
2. Domain types + zod schemas: `Asset`, `Quote`, `Candle`,
   `TechnicalSummary`, `Analysis`, `Scenario`, `TradeSetup`,
   `MarketRegime`, `RiskSettings`, `NewsItem`, `SentimentItem`.
3. Server-only env/config module with provider selection and the
   mock-in-production guard.
4. Provider interfaces + implementations: market-data (mock, none),
   news (none), sentiment (none), analysis (mock, none),
   TradingView symbol/config helpers.
5. Technical engine (SMA, EMA, RSI, MACD, ATR, swing points, structure,
   trend, per-timeframe bias, conflict detection) with unit tests.
6. Risk engine (position size, R/R, rule violations) with unit tests.
7. Repository interface; local JSON implementation (seeded example
   watchlist the user can freely edit/delete) and Supabase implementation.
8. Supabase migration `0001_initial_schema.sql`.
9. UI shell: navigation (Dashboard, Watchlist, Predictions, Paper Trades,
   Performance, Journal, Settings), responsive dark terminal theme,
   provenance/mock badges.
10. Watchlist page: add, edit (symbol, exchange, TradingView symbol,
    notes), enable/disable, remove.
11. Asset page: header (TradingView Symbol Info + provider quote), large
    TradingView Advanced Chart with timeframe selector, market structure,
    multi-timeframe table with TIMEFRAMES CONFLICT banner, news,
    sentiment, Watcher analysis, Bull/Base/Bear, self-challenge, trade
    plan or NO TRADE, risk check vs user rules, historical predictions
    placeholder.
12. Dashboard: market regime, watchlist overview, top setups / watch /
    no-trade buckets, open predictions & performance placeholders with
    "INSUFFICIENT SAMPLE SIZE", disabled "Run Daily Watch" (Phase 2).
13. Settings: risk rules form, provider status panel.
14. Placeholder pages for later phases that explain what will live there.
15. Optional Basic Auth proxy; `.env.example`; README.
16. Verify: typecheck, lint, unit tests, production build, manual run.
