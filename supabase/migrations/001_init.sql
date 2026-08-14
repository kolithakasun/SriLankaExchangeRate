-- Sri Lanka Exchange Rates schema
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists banks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  source_url text,
  priority int not null default 100,
  enabled boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists currencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  symbol text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists exchange_rates (
  id uuid primary key default gen_random_uuid(),
  bank_code text not null references banks(code),
  currency_code text not null references currencies(code),
  tt_buying numeric,
  tt_selling numeric,
  source_timestamp timestamptz,
  retrieved_at timestamptz not null,
  source text,
  raw_reference text,
  parser_version text,
  created_at timestamptz not null default now()
);

create index if not exists exchange_rates_bank_currency_retrieved_idx
  on exchange_rates (bank_code, currency_code, retrieved_at desc);

create index if not exists exchange_rates_retrieved_idx
  on exchange_rates (retrieved_at desc);

create table if not exists bank_status (
  bank_code text primary key references banks(code),
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

-- Seed banks
insert into banks (code, name, source_url, priority, enabled, featured) values
  ('SEYLAN', 'Seylan Bank', 'https://www.seylan.lk/exchange-rates', 1, true, true),
  ('HNB', 'Hatton National Bank', 'https://www.hnb.lk/exchange-rates', 2, true, true),
  ('COMMERCIAL', 'Commercial Bank', 'https://www.combank.lk/rates-tariff#exchange-rates', 3, true, true),
  ('SAMPATH', 'Sampath Bank', 'https://www.sampath.lk/rates-and-charges?activeTab=exchange-rates', 4, true, false),
  ('NDB', 'NDB Bank', 'https://www.ndbbank.com/rates/exchange-rates', 5, true, false),
  ('PEOPLES', 'People''s Bank', 'https://www.peoplesbank.lk/exchange-rates/', 6, true, false),
  ('BOC', 'Bank of Ceylon', 'https://www.boc.lk/rates-tariff', 7, true, false)
on conflict (code) do update set
  name = excluded.name,
  source_url = excluded.source_url,
  priority = excluded.priority,
  enabled = excluded.enabled,
  featured = excluded.featured;

insert into currencies (code, name, symbol, enabled) values
  ('USD', 'United States Dollar', '$', true),
  ('AUD', 'Australian Dollar', 'A$', true),
  ('EUR', 'Euro', '€', true),
  ('JPY', 'Japanese Yen', '¥', true),
  ('SGD', 'Singapore Dollar', 'S$', true)
on conflict (code) do update set
  name = excluded.name,
  symbol = excluded.symbol,
  enabled = excluded.enabled;

-- Public read access for anon key (optional; API functions use service role)
alter table banks enable row level security;
alter table currencies enable row level security;
alter table exchange_rates enable row level security;
alter table bank_status enable row level security;

drop policy if exists "Public read banks" on banks;
create policy "Public read banks" on banks for select using (true);

drop policy if exists "Public read currencies" on currencies;
create policy "Public read currencies" on currencies for select using (true);

drop policy if exists "Public read exchange_rates" on exchange_rates;
create policy "Public read exchange_rates" on exchange_rates for select using (true);

drop policy if exists "Public read bank_status" on bank_status;
create policy "Public read bank_status" on bank_status for select using (true);
