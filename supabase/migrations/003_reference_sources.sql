-- Forecast reference sources (CBSL official TT + Google mid).
-- Safe to re-run. Existing licensed-bank rows are left unchanged.

insert into banks (code, name, source_url, priority, enabled, featured) values
  (
    'CBSL',
    'Central Bank of Sri Lanka',
    'https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/daily-buy-and-sell-exchange-rates',
    90,
    true,
    false
  ),
  (
    'GOOGLE',
    'Google Finance',
    'https://www.google.com/finance/quote/USD-LKR',
    91,
    true,
    false
  )
on conflict (code) do update set
  name = excluded.name,
  source_url = excluded.source_url,
  priority = excluded.priority,
  enabled = excluded.enabled,
  featured = excluded.featured;
