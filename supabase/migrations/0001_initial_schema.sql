-- =============================================================================
-- WATCHER — initial schema
--
-- Principles enforced at the database level:
--   * history is append-only: analyses, market snapshots and predictions can
--     never be updated or deleted (triggers below)
--   * prediction status changes are new rows in prediction_events
--   * deleting an asset with history is blocked (ON DELETE RESTRICT);
--     removing it from a watchlist only deletes the watchlist_assets row
--   * row-level security: each row belongs to one user
--
-- Watcher stores NO broker credentials and has NO order tables. It is a
-- research system; the user executes real trades manually elsewhere.
-- =============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase runs 15+).

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type asset_type            as enum ('CRYPTO', 'STOCK', 'ETF');
create type timeframe             as enum ('15M', '1H', '4H', '1D', '1W');
create type bias                  as enum ('BULLISH', 'NEUTRAL', 'BEARISH');
create type regime_classification as enum ('BULLISH', 'NEUTRAL', 'BEARISH', 'UNCLEAR');
create type market_kind           as enum ('CRYPTO', 'STOCKS');
create type analysis_decision     as enum ('TRADE', 'WATCH', 'NO_TRADE');
create type trade_direction       as enum ('LONG', 'SHORT');
create type importance_level      as enum ('HIGH', 'MEDIUM', 'LOW');
create type sentiment_label       as enum ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED');
create type prediction_status     as enum (
  'OPEN', 'TARGET_1_HIT', 'TARGET_2_HIT', 'STOPPED_OUT',
  'INVALIDATED', 'EXPIRED', 'CANCELLED', 'NO_TRADE'
);
create type prediction_outcome    as enum ('WIN', 'LOSS', 'BREAKEVEN', 'NOT_TRIGGERED', 'NO_TRADE', 'CANCELLED');
create type run_status            as enum ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');
create type user_decision_kind    as enum (
  'FOLLOWED',          -- took the trade Watcher proposed
  'PARTIALLY_FOLLOWED',-- took it with different entry/stop/size
  'IGNORED',           -- Watcher proposed a trade, user did not take it
  'TRADED_AGAINST',    -- user traded the opposite direction
  'TRADED_ON_NO_TRADE',-- Watcher said NO TRADE / WATCH, user traded anyway
  'INDEPENDENT'        -- user trade with no related Watcher prediction
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function forbid_modification() returns trigger
language plpgsql as $$
begin
  raise exception 'Table % is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end $$;

-- ---------------------------------------------------------------------------
-- Users & settings
-- ---------------------------------------------------------------------------
create table users (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone     text not null default 'Europe/London',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger users_updated_at before update on users for each row execute function set_updated_at();

create table risk_settings (
  user_id                uuid primary key references users (id) on delete cascade,
  account_size           numeric(20, 2) check (account_size is null or account_size > 0),
  account_currency       text not null default 'GBP',
  max_risk_per_trade_pct numeric(5, 2) not null default 1    check (max_risk_per_trade_pct > 0 and max_risk_per_trade_pct <= 10),
  max_daily_loss_pct     numeric(5, 2) not null default 3    check (max_daily_loss_pct > 0 and max_daily_loss_pct <= 25),
  max_open_paper_trades  integer       not null default 5    check (max_open_paper_trades between 1 and 100),
  min_reward_risk        numeric(5, 2) not null default 2    check (min_reward_risk between 0.5 and 10),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger risk_settings_updated_at before update on risk_settings for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Watchlists & assets
-- ---------------------------------------------------------------------------
create table watchlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  name       text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create unique index watchlists_one_default on watchlists (user_id) where is_default;
create trigger watchlists_updated_at before update on watchlists for each row execute function set_updated_at();

create table assets (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id) on delete cascade,
  symbol             text not null check (symbol ~ '^[A-Z0-9.\-]{1,20}$'),
  name               text not null,
  asset_type         asset_type not null,
  exchange           text not null,
  currency           text not null,
  tradingview_symbol text not null default '',
  provider_symbol    text,             -- symbol as the market-data provider expects it
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, symbol)
);
create trigger assets_updated_at before update on assets for each row execute function set_updated_at();

create table watchlist_assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  watchlist_id uuid not null references watchlists (id) on delete cascade,
  asset_id     uuid not null references assets (id) on delete cascade,
  notes        text not null default '',
  is_active    boolean not null default true,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (watchlist_id, asset_id)
);
create index watchlist_assets_watchlist on watchlist_assets (watchlist_id, position);
create trigger watchlist_assets_updated_at before update on watchlist_assets for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Model & prompt versioning
-- ---------------------------------------------------------------------------
create table model_versions (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,      -- 'anthropic', 'mock', ...
  model_name    text not null,      -- e.g. 'claude-opus-5-5'
  model_version text not null,      -- provider-reported version / snapshot
  created_at    timestamptz not null default now(),
  unique (provider, model_name, model_version)
);

create table prompt_versions (
  id           uuid primary key default gen_random_uuid(),
  prompt_key   text not null,       -- 'asset_analysis', 'market_regime', ...
  version      text not null,       -- semantic version, e.g. '1.0.0'
  content_hash text not null,       -- sha256 of template
  template     text not null,
  created_at   timestamptz not null default now(),
  unique (prompt_key, version)
);
create trigger model_versions_immutable  before update or delete on model_versions  for each row execute function forbid_modification();
create trigger prompt_versions_immutable before update or delete on prompt_versions for each row execute function forbid_modification();

-- ---------------------------------------------------------------------------
-- Daily Watch runs & market regime
-- ---------------------------------------------------------------------------
create table daily_watch_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      run_status not null default 'RUNNING',
  error       text,
  created_at  timestamptz not null default now()
);

create table market_regimes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  run_id         uuid references daily_watch_runs (id) on delete restrict,
  market         market_kind not null,
  classification regime_classification not null,
  reasoning      text not null,
  inputs         jsonb not null default '{}'::jsonb,   -- the data the conclusion was based on
  missing_data   text[] not null default '{}',
  as_of          timestamptz not null,
  created_at     timestamptz not null default now()
);
create trigger market_regimes_immutable before update or delete on market_regimes for each row execute function forbid_modification();

-- ---------------------------------------------------------------------------
-- Market data snapshots (append-only)
-- ---------------------------------------------------------------------------
create table market_snapshots (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users (id) on delete cascade,
  asset_id          uuid not null references assets (id) on delete restrict,
  symbol            text not null,                 -- symbol at capture time
  provider          text not null,
  is_mock           boolean not null default false,
  price             numeric(30, 10) not null,
  change_24h_pct    numeric(12, 4),
  quote             jsonb not null,
  candles           jsonb not null default '{}'::jsonb,   -- per-timeframe OHLCV used for analysis
  technical_summary jsonb not null,
  data_timestamp    timestamptz not null,
  created_at        timestamptz not null default now()
);
create index market_snapshots_asset_time on market_snapshots (asset_id, data_timestamp desc);
create trigger market_snapshots_immutable before update or delete on market_snapshots for each row execute function forbid_modification();

-- ---------------------------------------------------------------------------
-- News & sentiment (append-only, deduplicated)
-- ---------------------------------------------------------------------------
create table news_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  asset_id     uuid references assets (id) on delete restrict,
  provider     text not null,
  source       text not null,
  title        text not null,
  url          text not null check (url ~ '^https?://'),
  published_at timestamptz not null,
  summary      text not null default '',
  importance   importance_level not null,
  sentiment    sentiment_label not null,
  raw          jsonb,
  created_at   timestamptz not null default now(),
  unique (user_id, url, asset_id)
);
create index news_items_asset_time on news_items (asset_id, published_at desc);
create trigger news_items_immutable before update or delete on news_items for each row execute function forbid_modification();

create table sentiment_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  asset_id   uuid references assets (id) on delete restrict,
  provider   text not null,
  source     text not null,          -- 'reddit', 'analyst', ...
  community  text not null default '',-- author or community, e.g. 'r/CryptoCurrency'
  url        text check (url is null or url ~ '^https?://'),
  posted_at  timestamptz not null,
  sentiment  sentiment_label not null,
  summary    text not null,
  relevance  importance_level not null,
  created_at timestamptz not null default now()
);
create index sentiment_items_asset_time on sentiment_items (asset_id, posted_at desc);
create trigger sentiment_items_immutable before update or delete on sentiment_items for each row execute function forbid_modification();

-- ---------------------------------------------------------------------------
-- Analyses (append-only)
-- ---------------------------------------------------------------------------
create table analyses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users (id) on delete cascade,
  asset_id            uuid not null references assets (id) on delete restrict,
  run_id              uuid references daily_watch_runs (id) on delete restrict,
  snapshot_id         uuid references market_snapshots (id) on delete restrict,
  regime_id           uuid references market_regimes (id) on delete restrict,
  model_version_id    uuid not null references model_versions (id),
  prompt_version_id   uuid references prompt_versions (id),
  analysis_version    text not null,
  data_timestamp      timestamptz not null,
  is_mock             boolean not null default false,
  thesis_bias         bias not null,
  decision            analysis_decision not null,
  timeframes_conflict boolean not null,
  timeframe_biases    jsonb not null,  -- {"1D":"BULLISH","4H":"NEUTRAL",...}
  input_document      jsonb not null,  -- exactly what the model saw
  output              jsonb not null,  -- full validated analysis
  created_at          timestamptz not null default now()
);
create index analyses_asset_time on analyses (asset_id, created_at desc);
create trigger analyses_immutable before update or delete on analyses for each row execute function forbid_modification();

-- ---------------------------------------------------------------------------
-- Prediction ledger (immutable)
-- ---------------------------------------------------------------------------
create table predictions (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references users (id) on delete cascade,
  asset_id                   uuid not null references assets (id) on delete restrict,
  analysis_id                uuid not null references analyses (id) on delete restrict,
  symbol                     text not null,
  created_at                 timestamptz not null default now(),
  direction                  trade_direction,             -- null for NO_TRADE records
  entry_low                  numeric(30, 10),
  entry_high                 numeric(30, 10),
  invalidation               numeric(30, 10),             -- stop level
  target_1                   numeric(30, 10),
  target_2                   numeric(30, 10),
  timeframe                  text not null,
  expires_at                 timestamptz not null,
  confidence                 numeric(5, 2) not null check (confidence between 0 and 100),
  bull_probability           numeric(5, 2) not null check (bull_probability between 0 and 100),
  base_probability           numeric(5, 2) not null check (base_probability between 0 and 100),
  bear_probability           numeric(5, 2) not null check (bear_probability between 0 and 100),
  thesis                     text not null,
  strongest_counter_argument text not null,
  invalidation_condition     text not null,
  market_regime              regime_classification not null,
  news_context               jsonb not null default '[]'::jsonb,
  technical_context          jsonb not null,
  model_name                 text not null,
  model_version              text not null,
  prompt_version             text not null,
  initial_status             prediction_status not null default 'OPEN'
                               check (initial_status in ('OPEN', 'NO_TRADE')),
  -- Locked forward-testing snapshot: market data, analysis, news, prediction,
  -- confidence, model and prompt version, exactly as known at creation time.
  snapshot                   jsonb not null,
  snapshot_sha256            text not null,
  check (abs(bull_probability + base_probability + bear_probability - 100) <= 1),
  check (
    initial_status = 'NO_TRADE'
    or (direction is not null and entry_low is not null and entry_high is not null
        and invalidation is not null and target_1 is not null and entry_low <= entry_high)
  ),
  check (
    direction is null
    or (direction = 'LONG'  and invalidation < entry_low  and target_1 > entry_high)
    or (direction = 'SHORT' and invalidation > entry_high and target_1 < entry_low)
  )
);
create index predictions_asset_time on predictions (asset_id, created_at desc);
create trigger predictions_immutable before update or delete on predictions for each row execute function forbid_modification();

create table prediction_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  prediction_id uuid not null references predictions (id) on delete restrict,
  status        prediction_status not null,
  price         numeric(30, 10),
  occurred_at   timestamptz not null,       -- market time the event happened
  reason        text not null,
  source        text not null,              -- 'resolver', 'user', 'daily_watch'
  created_at    timestamptz not null default now()
);
create index prediction_events_prediction on prediction_events (prediction_id, occurred_at desc, created_at desc);
create trigger prediction_events_immutable before update or delete on prediction_events for each row execute function forbid_modification();

create table prediction_results (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users (id) on delete cascade,
  prediction_id          uuid not null unique references predictions (id) on delete restrict,
  final_status           prediction_status not null,
  result                 prediction_outcome not null,
  resolved_at            timestamptz not null,
  entry_filled_at        timestamptz,
  entry_price            numeric(30, 10),
  exit_price             numeric(30, 10),
  actual_return          numeric(12, 6),    -- fractional hypothetical return
  r_multiple             numeric(10, 4),
  max_adverse_excursion  numeric(12, 6),
  max_favorable_excursion numeric(12, 6),
  direction_correct      boolean,
  evaluation_notes       text not null default '',
  created_at             timestamptz not null default now()
);
create trigger prediction_results_immutable before update or delete on prediction_results for each row execute function forbid_modification();

create view prediction_status_current with (security_invoker = true) as
select p.id as prediction_id,
       p.user_id,
       coalesce(e.status, p.initial_status) as status,
       e.occurred_at as status_changed_at
from predictions p
left join lateral (
  select status, occurred_at from prediction_events pe
  where pe.prediction_id = p.id
  order by pe.occurred_at desc, pe.created_at desc
  limit 1
) e on true;

-- ---------------------------------------------------------------------------
-- Paper trading (hypothetical only — never routed to a broker)
-- ---------------------------------------------------------------------------
create table paper_trades (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id) on delete cascade,
  asset_id           uuid not null references assets (id) on delete restrict,
  prediction_id      uuid references predictions (id) on delete restrict,
  direction          trade_direction not null,
  entry              numeric(30, 10) not null,
  stop               numeric(30, 10) not null,
  target             numeric(30, 10) not null,
  risk_amount        numeric(20, 2) not null check (risk_amount > 0),
  position_size      numeric(30, 10) not null check (position_size > 0),
  opened_at          timestamptz not null default now(),
  closed_at          timestamptz,
  exit_price         numeric(30, 10),
  pnl                numeric(20, 2),
  r_multiple         numeric(10, 4),
  reason             text not null,
  close_reason       text,
  created_at         timestamptz not null default now(),
  check ((closed_at is null) = (exit_price is null))
);
create index paper_trades_open on paper_trades (user_id) where closed_at is null;

-- A paper trade may only move from open to closed once; its opening terms are fixed.
create or replace function paper_trade_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'paper_trades rows cannot be deleted';
  end if;
  if old.closed_at is not null then
    raise exception 'closed paper trades are immutable';
  end if;
  if (new.asset_id, new.prediction_id, new.direction, new.entry, new.stop, new.target,
      new.risk_amount, new.position_size, new.opened_at, new.reason)
     is distinct from
     (old.asset_id, old.prediction_id, old.direction, old.entry, old.stop, old.target,
      old.risk_amount, old.position_size, old.opened_at, old.reason) then
    raise exception 'opening terms of a paper trade cannot be changed';
  end if;
  return new;
end $$;
create trigger paper_trades_guard before update or delete on paper_trades for each row execute function paper_trade_guard();

-- ---------------------------------------------------------------------------
-- Watcher vs User
-- ---------------------------------------------------------------------------
create table user_decisions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  prediction_id uuid references predictions (id) on delete restrict,
  analysis_id   uuid references analyses (id) on delete restrict,
  asset_id      uuid not null references assets (id) on delete restrict,
  decision      user_decision_kind not null,
  rationale     text not null default '',
  decided_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create trigger user_decisions_immutable before update or delete on user_decisions for each row execute function forbid_modification();

create table journal_entries (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users (id) on delete cascade,
  asset_id           uuid references assets (id) on delete restrict,
  prediction_id      uuid references predictions (id) on delete restrict,
  user_decision_id   uuid references user_decisions (id) on delete restrict,
  -- the user's ACTUAL trade, recorded manually (Watcher never executes)
  platform           text,                 -- 'Coinbase', 'Trading 212', ...
  direction          trade_direction,
  entry_price        numeric(30, 10),
  exit_price         numeric(30, 10),
  quantity           numeric(30, 10),
  fees               numeric(20, 2),
  entered_at         timestamptz,
  exited_at          timestamptz,
  actual_pnl         numeric(20, 2),
  actual_r_multiple  numeric(10, 4),
  reason_for_entry   text not null default '',
  reason_for_exit    text not null default '',
  followed_watcher   boolean,
  disagreed_with_watcher boolean,
  emotional_state    text not null default '',
  mistakes           text not null default '',
  lessons            text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger journal_entries_updated_at before update on journal_entries for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Reports & alerts
-- ---------------------------------------------------------------------------
create table daily_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  run_id      uuid not null unique references daily_watch_runs (id) on delete restrict,
  report_date date not null,
  content     jsonb not null,     -- structured sections (regime, changes, setups, ...)
  markdown    text not null,
  created_at  timestamptz not null default now()
);
create trigger daily_reports_immutable before update or delete on daily_reports for each row execute function forbid_modification();

create table alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  asset_id    uuid references assets (id) on delete restrict,
  source      text not null default 'tradingview',
  payload     jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  analysis_id uuid references analyses (id) on delete restrict,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'risk_settings', 'watchlists', 'assets', 'watchlist_assets', 'daily_watch_runs',
    'market_regimes', 'market_snapshots', 'news_items', 'sentiment_items', 'analyses',
    'predictions', 'prediction_events', 'prediction_results', 'paper_trades',
    'user_decisions', 'journal_entries', 'daily_reports', 'alerts'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t
    );
  end loop;
end $$;

alter table users enable row level security;
create policy users_self on users for all using (id = auth.uid()) with check (id = auth.uid());

-- Versions are shared reference data: readable by any signed-in user,
-- written only by the server (service role bypasses RLS).
alter table model_versions  enable row level security;
alter table prompt_versions enable row level security;
create policy model_versions_read  on model_versions  for select using (auth.role() = 'authenticated');
create policy prompt_versions_read on prompt_versions for select using (auth.role() = 'authenticated');
