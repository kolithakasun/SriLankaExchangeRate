# Sri Lanka Bank Exchange Rates

Compare **Telegraphic Transfer (TT) Buying and Selling** rates across major Sri Lankan banks.

Built for **Netlify** (static frontend + serverless functions) with **Supabase** for historical storage. No always-on server, Docker, or VPS required.

## Features

- TT Buying / TT Selling for Seylan, HNB, Commercial Bank, Sampath, NDB, People's Bank, and BOC
- Currencies: USD, AUD, EUR, JPY, SGD (config-driven)
- Featured banks (Seylan · HNB · Commercial)
- Bank comparison + best buying / best selling highlights
- Intraday historical observations (not one row per day)
- History table + simple chart
- Forecast assistant: best day suggestion (buy/sell) + short-term trend projection
- Source freshness / health indicators
- Manual refresh (with cooldown) + scheduled collection every 30 minutes
- Light / dark mode

## Will this work on Netlify?

**Yes.** The project is already wired for Netlify:

| Piece | How it runs on Netlify |
|-------|-------------------------|
| Frontend | Vite build → `dist/` (publish directory) |
| API | `netlify/functions` → `/api/*` via redirects in `netlify.toml` |
| Scheduled refresh | `scheduled-refresh` function (`*/30 * * * *`) |
| Database | Supabase (external Postgres) — set env vars in Netlify |

You only need to:

1. Push the repo to GitHub  
2. Connect it to Netlify  
3. Add the same env vars you use locally  
4. Deploy, then click **Refresh Rates** once (or call `/api/refresh`)

---

## Architecture

```text
Browser (React + Vite)
   │
   ▼
Netlify Frontend
   │
   ▼
Netlify Functions  (/api/*)
   ├── providers (one per bank)
   └── Supabase / PostgreSQL
```

Bank websites are **never scraped from the browser**. Collection runs only in Netlify Functions.

### Bank sources

See [`docs/SOURCES.md`](docs/SOURCES.md) for details.

| Bank | Delivery | TT fields |
|------|----------|-----------|
| Seylan | HTML table | Telegraphic Transfers buy/sell |
| HNB | JSON API `venus.hnb.lk` | `buyingRate` / `sellingRate` |
| Commercial Bank | HTML table | Telegraphic Transfers buy/sell |
| Sampath | JSON `sampath.lk/api/exchange-rates` | `TTBUY` / `TTSEL` |
| NDB | HTML table | Telegraphic Transfer buy/sell |
| People's Bank | HTML table | Telegraphic Transfers buy/sell |
| BOC | HTML table | Telegraphic/PFCA/BFCA Transfers buy/sell |

---

## Prerequisites

- Node.js 20+ (22.x works)
- A free [Supabase](https://supabase.com) project
- (Local full stack) Netlify CLI via `npx` — no global install required

---

## 1. Supabase setup (do this first)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → New query.
3. Paste and run the full contents of [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
4. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **Publishable / anon key** → `SUPABASE_ANON_KEY`
   - **Secret / service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

**Never** put the service role / secret key in frontend code or `VITE_*` variables.

---

## 2. Environment variables

Copy the example file:

```bash
cp .env.example .env
```

Fill in `.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-or-service-role-key

REFRESH_TOKEN=any-long-random-string
REQUIRE_REFRESH_TOKEN=false
REFRESH_COOLDOWN_SECONDS=60
RATE_REFRESH_INTERVAL=30

# Leave empty — the UI uses /api, not Supabase directly
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes (prod / history) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (prod / history) | Server-side read/write for collectors |
| `SUPABASE_ANON_KEY` | Optional | Documented for completeness |
| `REFRESH_TOKEN` | Optional | Used if you set `REQUIRE_REFRESH_TOKEN=true` |
| `REQUIRE_REFRESH_TOKEN` | No (default `false`) | When `true`, `/api/refresh` needs header `x-refresh-token` |
| `REFRESH_COOLDOWN_SECONDS` | No (default `60`) | Limits how often refresh can run |
| `RATE_REFRESH_INTERVAL` | No (default `30`) | Hint for “stale” status in the UI |
| `VITE_SUPABASE_*` | No | Not used by the current UI |

Without Supabase credentials, the app falls back to a **local temp JSON store** (fine for quick UI work, not for production history).

---

## 3. Run locally

### Recommended: frontend + API together

```bash
npm install
npx netlify-cli dev
```

Then open **http://localhost:8888**

This starts:

- Vite frontend (internally on `5173`)
- Netlify Functions on `/api/*`
- Redirects from `netlify.toml`

### Load rates the first time

In the UI, click **Refresh Rates**.

Or from a terminal:

```bash
curl -X POST http://localhost:8888/api/refresh
```

If you set `REQUIRE_REFRESH_TOKEN=true`:

```bash
curl -X POST http://localhost:8888/api/refresh \
  -H "x-refresh-token: YOUR_REFRESH_TOKEN"
```

You should see bank TT values after a few seconds. Refresh the browser if needed.

### Frontend only (not enough for rates)

```bash
npm run dev
```

Opens **http://localhost:5173**, but `/api/*` proxies to port `8888`.  
If Netlify Dev is **not** running, you will see `ECONNREFUSED` proxy errors. Use `npx netlify-cli dev` for a working dashboard.

### Useful scripts

```bash
npm run dev        # frontend only (port 5173)
npm run build      # production build → dist/
npm run preview    # preview production build
npm test           # offline parser/validation tests
npm run test:live  # live bank provider smoke test (needs network)
```

---

## 4. Deploy to Netlify

### A. Push to GitHub

Commit your code (do **not** commit `.env`) and push to GitHub.

### B. Create the Netlify site

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Select your GitHub repo
3. Confirm build settings (already in `netlify.toml`):

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |

### C. Add environment variables

Netlify → **Site configuration → Environment variables** → add at least:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (optional)
- `REFRESH_TOKEN` (optional)
- `REQUIRE_REFRESH_TOKEN` = `false` (or `true` for stricter production)
- `REFRESH_COOLDOWN_SECONDS` = `60`
- `RATE_REFRESH_INTERVAL` = `30`

Use the **same values** as your local `.env`.

### D. Deploy

Click **Deploy site**. When it finishes, open the site URL.

### E. First data load

Click **Refresh Rates** on the site, or:

```bash
curl -X POST https://YOUR_SITE.netlify.app/api/refresh
```

### F. Scheduled collection

`netlify/functions/scheduled-refresh.ts` is configured to run every **30 minutes**.

Scheduled functions need a Netlify plan that supports them. If scheduling is unavailable on your plan, use the Refresh button or an external cron hitting `/api/refresh`.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/rates?currency=USD` | Latest rates + best rates |
| `GET` | `/api/history?bank=SEYLAN&currency=USD&date=2026-08-14` | Intraday history |
| `GET` | `/api/forecast?bank=SEYLAN&currency=USD&window=7&horizon=3` | Daily trend forecast + suggested best day |
| `GET` | `/api/banks` | Bank config |
| `GET` | `/api/currencies` | Currency config |
| `POST` | `/api/refresh` | Fetch banks + store new observations |

## Forecast model notes

- Current method is a free local/statistical approach (`trend_regression`) using your stored historical rates.
- With only one day of history, the API returns low-confidence guidance and asks for more data.
- Accuracy improves once you collect ~7+ days of observations.

## "AI" and cost (ChatGPT Go)

- Your ChatGPT Go plan is for chat usage, not OpenAI API billing/keys.
- So a server-side OpenAI call from Netlify is not free by default and is not covered by ChatGPT Go.
- This project now includes a no-cost built-in forecasting assistant so you can start immediately.
- If you later want LLM-written narrative explanations, you can add an optional API-based layer behind a feature flag.

---

## Adding a bank

1. Create `netlify/functions/providers/newbank.ts` implementing `BankExchangeRateProvider`.
2. Prefer official JSON endpoints; otherwise parse HTML via `shared/utils/html.ts`.
3. Register it in `netlify/functions/providers/index.ts`.
4. Add config in `shared/config/banks.ts`.
5. Add a fixture + test under `tests/`.

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

Providers already return whatever the bank publishes; enabling the currency is enough for UI/API filters.

---

## Testing

```bash
npm test
```

Covers:

- Numeric parsing / invalid values (`-`, `N/A`)
- TT column extraction (not notes/drafts)
- Validation ranges
- Duplicate detection helpers
- Sampath JSON normalization

Live bank check:

```bash
npm run test:live
```

---

## Project structure

```text
/
├── src/                      # React frontend
├── shared/                   # Shared config, types, utils
├── netlify/functions/        # API + providers + scheduled job
│   ├── rates.ts
│   ├── history.ts
│   ├── refresh.ts
│   ├── scheduled-refresh.ts
│   └── providers/
├── supabase/migrations/      # SQL schema
├── tests/                    # Vitest + fixtures
├── docs/SOURCES.md           # Bank source notes
├── netlify.toml
├── .env.example
└── README.md
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on `/api/*` with `npm run dev` | Run `npx netlify-cli dev` and use port **8888** |
| Empty rates / dashes | Click **Refresh Rates**, or `POST /api/refresh`. Confirm SQL migration was run |
| `Unauthorized refresh token` | Either send `x-refresh-token`, or set `REQUIRE_REFRESH_TOKEN=false` |
| `Please wait 60s…` | Cooldown — wait, or lower `REFRESH_COOLDOWN_SECONDS` locally |
| Supabase insert errors | Confirm `SUPABASE_SERVICE_ROLE_KEY` is the **secret/service_role** key, not the publishable key |
| One bank missing | Check Netlify function logs; that provider failed independently |

---

## Notes / limitations

- Bank sites can change; each provider is isolated so fixes stay local.
- If a provider fails, the UI keeps the last valid rate and shows a stale/error indicator.
- HNB’s public API returns one buy/sell pair labelled as Telegraphic Transfer in their UI.
- Some banks may omit a currency on some days; missing values are not stored as zeros.
- Rates are indicative — confirm with your bank before transacting.
