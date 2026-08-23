# Bank source formats

Inspected August 2026. Each provider is isolated so a source change only requires updating one file.

| Bank | Type | Endpoint / page | TT mapping |
|------|------|-----------------|------------|
| Seylan | HTML table | https://www.seylan.lk/exchange-rates | Telegraphic Transfers buy/sell (cols 6–7) |
| HNB | JSON API | https://venus.hnb.lk/api/get_rates_contents_web | `buyingRate` / `sellingRate` (UI: Telegraphic Transfer) |
| Commercial Bank | HTML table | https://www.combank.lk/rates-tariff | Telegraphic Transfers buy/sell |
| Sampath | JSON API | https://www.sampath.lk/api/exchange-rates | `TTBUY` / `TTSEL` |
| NDB | HTML table | https://www.ndbbank.com/rates/exchange-rates | Telegraphic Transfer buy/sell |
| People's Bank | HTML table | https://www.peoplesbank.lk/exchange-rates/ | Telegraphic Transfers buy/sell (currency label in `<th>`) |
| BOC | HTML table | https://www.boc.lk/rates-tariff | Telegraphic/PFCA/BFCA Transfers buy/sell |
| CBSL (reference) | HTML form POST | https://www.cbsl.gov.lk/cbsl_custom/exratestt/exrates_resultstt.php | Official 9:30 a.m. TT buy/sell average. Fallback: chart widgets `/cbsl_custom/charts/{usd,aud}/indexsmall.php` |
| Google (reference) | HTML quote page | https://www.google.com/finance/quote/USD-LKR (and AUD/EUR/JPY/SGD) | Single mid-market quote stored on both TT fields |

## Notes

- HNB’s public site is a React SPA; rates are loaded from `venus.hnb.lk`, not from static HTML.
- Sampath’s marketing site is Nuxt; rates are loaded from `/api/exchange-rates`.
- Commercial Bank and People's Bank HTML layouts are non-trivial (colspans / th+td rows). Providers use explicit TT column fallbacks.
- CBSL and Google are **forecast reference sources**, not licensed banks. Forecasts read their stored daily trend for the selected window (1W–All). CBSL is live-fetched only when the DB is too thin for that window (capped at 1 year); Google uses stored days plus today's mid. They do not win best-rate highlights.
- CBSL TT search has no weekend/holiday rows; the collector looks back 7 days and keeps the newest published date.
- Google Finance has no official API. The parser reads the `"USD / LKR",<price>` blob. Treat the quote as mid-market, not bank TT.
- Do not scrape from the browser. Collection runs only in Netlify Functions.
- Do not bypass CAPTCHAs, WAFs, or authentication.

## Live provider check

```bash
LIVE_PROVIDERS=1 npx vitest run tests/live-providers.test.ts
```
