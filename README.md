# Sri Lanka Bank Exchange Rates

Compare **Telegraphic Transfer (TT) Buying and Selling** rates across major Sri Lankan banks. Built for easy deployment on **Netlify** with serverless collection and **Supabase** history storage.

## Features

- TT Buying / TT Selling for Seylan, HNB, Commercial Bank, Sampath, NDB, People's Bank, and BOC
- Currencies: USD, AUD, EUR, JPY, SGD (config-driven)
- Featured banks section (Seylan · HNB · Commercial)
- Bank comparison with best buying / best selling highlights
- Intraday historical observations (not one row per day)
- Simple history table + chart
- Source health / freshness indicators
- Scheduled refresh via Netlify Scheduled Functions
- Light / dark mode

## Architecture

```text
Browser (React + Vite)
   │
   ▼
Netlify Frontend
   │
   ▼
Netlify Functions  (/api/*)
   ├── providers (per bank)
   └── Supabase / PostgreSQL
```

Bank websites are **never scraped from the browser**. Collection runs only in Netlify Functions.

### Source formats (inspected Aug 2026)

| Bank | Delivery | TT fields |
|------|----------|-----------|
| Seylan | HTML table | Telegraphic Transfers buy/sell |
| HNB | JSON API `venus.hnb.lk` | `buyingRate` / `sellingRate` (labelled TT in UI) |
| Commercial Bank | HTML table | Telegraphic Transfers buy/sell |
| Sampath | JSON `sampath.lk/api/exchange-rates` | `TTBUY` / `TTSEL` |
| NDB | HTML table | Telegraphic Transfer buy/sell |
| People's Bank | HTML table | Telegraphic Transfers buy/sell |
| BOC | HTML table | Telegraphic/PFCA/BFCA Transfers buy/sell |

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend: Vite on port `5173`.

To exercise API functions locally:

```bash
npx netlify-cli dev
```

This serves the site and functions together (default port `8888`).

Without Supabase credentials, rates are stored in a local JSON file under the OS temp directory so you can still develop and test.

### Useful scripts

```bash
npm run dev       # frontend only
npm run build     # production frontend build
npm test          # parser / validation tests
npm run preview   # preview production build
```

## Environment variables

See `.env.example`.

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Netlify Functions | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify Functions only | Write access for collectors |
| `SUPABASE_ANON_KEY` | Optional | Public read if using client SDK |
| `VITE_SUPABASE_*` | Frontend (optional) | Not required; app uses `/api` |
| `REFRESH_TOKEN` | Functions | Protects `POST /api/refresh` |
| `REFRESH_COOLDOWN_SECONDS` | Functions | Public refresh cooldown (default 60) |
| `RATE_REFRESH_INTERVAL` | Functions | Stale threshold hint (minutes) |

**Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
3. Copy project URL + service role key into Netlify env vars / local `.env`.

Schema highlights:

- `exchange_rates` stores every meaningful observation with timestamps
- `bank_status` tracks `last_checked_at` / `last_changed_at` / errors
- Unchanged rates are not duplicated; the check timestamp is still updated

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rates?currency=USD` | Latest rates + best rates |
| GET | `/api/history?bank=SEYLAN&currency=USD&date=2026-08-14` | Intraday history |
| GET | `/api/banks` | Bank config |
| GET | `/api/currencies` | Currency config |
| POST | `/api/refresh` | Manual collection (rate-limited / token) |

Scheduled collector: `scheduled-refresh` (every 30 minutes).

## Netlify deployment

1. Push this repository to GitHub.
2. In Netlify: **Add new site → Import an existing project**.
3. Build settings (also in `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Add environment variables listed above.
5. Deploy.
6. Confirm scheduled functions are enabled on your Netlify plan (cron: `*/30 * * * *`).
7. Trigger an initial refresh:

```bash
curl -X POST https://YOUR_SITE.netlify.app/api/refresh \
  -H "x-refresh-token: YOUR_REFRESH_TOKEN"
```

No always-on Node server, Docker, or VPS is required.

## Adding a bank

1. Create `netlify/functions/providers/newbank.ts` implementing `BankExchangeRateProvider`.
2. Prefer official JSON endpoints; otherwise parse HTML using TT header detection in `shared/utils/html.ts`.
3. Register it in `netlify/functions/providers/index.ts`.
4. Add config in `shared/config/banks.ts`.
5. Add a fixture + parser test under `tests/`.

## Adding a currency

Edit `shared/config/currencies.ts`:

```ts
{
  code: "GBP",
  name: "British Pound",
  symbol: "£",
  enabled: true,
  decimals: 2,
}
```

Providers already return whatever the bank publishes; enabling the currency is enough for the UI/API filters.

## Testing

```bash
npm test
```

Tests cover:

- Numeric parsing / invalid values (`-`, `N/A`)
- TT column extraction (not notes/drafts)
- Validation ranges
- Duplicate detection helpers
- Sampath JSON normalization

## Project structure

```text
/
├── src/                    # React frontend
├── shared/                 # Config, types, shared utils
├── netlify/functions/      # API + providers + scheduled job
├── supabase/migrations/    # SQL schema
├── tests/                  # Vitest + fixtures
├── docs/SOURCES.md         # Bank source format notes
├── netlify.toml
└── .env.example
```

## Notes / limitations

- Bank sites can change HTML or APIs; each provider is isolated so fixes stay local.
- If a provider fails, the dashboard keeps the last valid rate and shows a stale/error indicator.
- HNB’s public API returns a single buy/sell pair labelled as Telegraphic Transfer in their UI.
- People's Bank / others may omit some currencies on some days; missing values are not stored as zeros.
