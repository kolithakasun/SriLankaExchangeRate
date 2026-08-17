-- Daily rate snapshots: exactly one row per bank + currency + Colombo day.
-- The row is created on the first successful check of the day (even when the rate
-- matches the previous day) and updated in place when the rate moves later that day.
-- Run this in the Supabase SQL editor after 001_init.sql.

create table if not exists daily_rates (
  id uuid primary key default gen_random_uuid(),
  bank_code text not null references banks(code),
  currency_code text not null references currencies(code),
  rate_date date not null,
  -- Latest values seen on rate_date
  tt_buying numeric,
  tt_selling numeric,
  -- First values seen on rate_date
  open_tt_buying numeric,
  open_tt_selling numeric,
  source_timestamp timestamptz,
  first_seen_at timestamptz not null,
  last_checked_at timestamptz not null,
  last_changed_at timestamptz,
  change_count integer not null default 0,
  observations integer not null default 1,
  parser_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_rates_unique_day unique (bank_code, currency_code, rate_date)
);

create index if not exists daily_rates_bank_currency_date_idx
  on daily_rates (bank_code, currency_code, rate_date desc);

create index if not exists daily_rates_date_idx
  on daily_rates (rate_date desc);

-- Backfill from observations already collected in exchange_rates.
-- Days that were never checked stay absent; nothing is invented here.
insert into daily_rates (
  bank_code,
  currency_code,
  rate_date,
  tt_buying,
  tt_selling,
  open_tt_buying,
  open_tt_selling,
  source_timestamp,
  first_seen_at,
  last_checked_at,
  last_changed_at,
  change_count,
  observations,
  parser_version
)
select
  grouped.bank_code,
  grouped.currency_code,
  grouped.rate_date,
  grouped.close_buying,
  grouped.close_selling,
  grouped.open_buying,
  grouped.open_selling,
  grouped.source_timestamp,
  grouped.first_seen_at,
  grouped.last_seen_at,
  grouped.last_seen_at,
  greatest(grouped.observations - 1, 0),
  grouped.observations,
  grouped.parser_version
from (
  select
    bank_code,
    currency_code,
    (retrieved_at at time zone 'Asia/Colombo')::date as rate_date,
    min(retrieved_at) as first_seen_at,
    max(retrieved_at) as last_seen_at,
    count(*)::int as observations,
    (array_agg(tt_buying order by retrieved_at asc))[1] as open_buying,
    (array_agg(tt_selling order by retrieved_at asc))[1] as open_selling,
    (array_agg(tt_buying order by retrieved_at desc))[1] as close_buying,
    (array_agg(tt_selling order by retrieved_at desc))[1] as close_selling,
    (array_agg(source_timestamp order by retrieved_at desc))[1] as source_timestamp,
    (array_agg(parser_version order by retrieved_at desc))[1] as parser_version
  from exchange_rates
  group by 1, 2, 3
) as grouped
on conflict (bank_code, currency_code, rate_date) do nothing;

alter table daily_rates enable row level security;

drop policy if exists "Public read daily_rates" on daily_rates;
create policy "Public read daily_rates" on daily_rates for select using (true);
