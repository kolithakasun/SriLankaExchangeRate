-- USDT P2P sources (Binance + Bybit) for LKR bank-transfer quotes.
-- Run after 001–005. Safe to re-run (upsert).

insert into banks (code, name, source_url, priority, enabled, featured) values
  (
    'BINANCE_P2P',
    'Binance P2P',
    'https://p2p.binance.com/trade/sell/USDT?fiat=LKR&payment=BankSriLanka',
    20,
    true,
    true
  ),
  (
    'BYBIT_P2P',
    'Bybit P2P',
    'https://www.bybit.com/en/p2p/sell/USDT/LKR',
    21,
    true,
    true
  )
on conflict (code) do update set
  name = excluded.name,
  source_url = excluded.source_url,
  priority = excluded.priority,
  enabled = excluded.enabled,
  featured = excluded.featured;

insert into currencies (code, name, symbol, enabled) values
  ('USDT', 'Tether', '₮', true)
on conflict (code) do update set
  name = excluded.name,
  symbol = excluded.symbol,
  enabled = excluded.enabled;
