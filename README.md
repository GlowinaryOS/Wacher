# Watcher

A private market research, analysis, prediction and paper-trading terminal.

**Watcher is not a trading bot.** It never buys, sells, transfers money or
places orders, and it has no broker integration. You make every real-money
decision yourself and execute it on your own platform.

The long-term goal is to find out, from recorded predictions and forward
testing, whether the Watcher method has a measurable edge, and to say so
plainly if it doesn't.

- Architecture, data flow, schema, TradingView approach and phase plan:
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Database schema: [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql)

## Status: Phase 1

| Area | State |
|---|---|
| Next.js 16 / TypeScript / Tailwind 4 app shell, responsive dark terminal UI | ✅ |
| Watchlist: add, edit, enable/disable, remove (crypto, stocks, ETFs) | ✅ |
| Asset page with the official TradingView Advanced Chart + Symbol Info widgets | ✅ |
| Technical engine (SMA/EMA/RSI/MACD/ATR, swing structure, multi-timeframe, conflict detection) | ✅ unit-tested |
| Risk engine (position sizing, R/R, rule violations) + risk settings | ✅ unit-tested |
| Provider interfaces: market data, news, sentiment, analysis | ✅ |
| Supabase/Postgres schema with append-only history and RLS | ✅ |
| Real market data, news, Claude analysis, Daily Watch | Phase 2 |
| Prediction ledger, resolution, performance, calibration | Phase 3 |
| Paper trading, journal, Watcher-vs-user | Phase 4 |
| TradingView alert webhooks | Phase 5 |

### What is mocked right now

With no providers configured, development mode uses:

- **Synthetic market data.** A deterministic random walk per symbol.
  Prices are deliberately unrealistic and labelled **SYNTHETIC**.
- **Mock analysis.** A transparent rule set, not Claude, labelled
  **MOCK ANALYSIS — NOT REAL**.
- **Market regime** is always `UNCLEAR`. It is never inferred from synthetic data.
- **News and sentiment** are not mocked. They show "not configured", so a
  fake headline or URL can never appear.

Mock providers are refused in production builds unless
`WATCHER_ALLOW_MOCK_IN_PRODUCTION=true`.

## Running locally

```bash
npm install
cp .env.example .env.local   # optional; defaults work for local dev
npm run dev                  # http://localhost:3000
```

Data is stored in `.watcher-data/watcher.json` (gitignored). On first run
the store is seeded with an example watchlist. It's ordinary data, so edit
or delete it freely.

```bash
npm test           # unit tests (vitest)
npm run typecheck  # route types + tsc
npm run lint
npm run build
```

## Using Supabase

1. Create a Supabase project and apply `supabase/migrations/0001_initial_schema.sql`
   (SQL editor, or `supabase db push`).
2. Create your user in Supabase Auth, then insert the matching profile:
   `insert into public.users (id) values ('<your auth user uuid>');`
3. Set `WATCHER_DATA_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` and `WATCHER_OWNER_USER_ID` in `.env.local`.

The service-role key is only ever read on the server.

## Security

- All API keys are server-side only. No secret uses a `NEXT_PUBLIC_` prefix.
- Set `WATCHER_BASIC_AUTH_USER` / `WATCHER_BASIC_AUTH_PASSWORD` to put the
  whole app behind HTTP Basic Auth whenever it runs anywhere but your own machine.
- External data is validated with zod before use.
