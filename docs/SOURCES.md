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

## Notes

- HNB’s public site is a React SPA; rates are loaded from `venus.hnb.lk`, not from static HTML.
- Sampath’s marketing site is Nuxt; rates are loaded from `/api/exchange-rates`.
- Commercial Bank and People's Bank HTML layouts are non-trivial (colspans / th+td rows). Providers use explicit TT column fallbacks.
- Do not scrape from the browser. Collection runs only in Netlify Functions.
- Do not bypass CAPTCHAs, WAFs, or authentication.

## Live provider check

```bash
LIVE_PROVIDERS=1 npx vitest run tests/live-providers.test.ts
```
