# Sri Lanka Bank Exchange Rates

Compare **Telegraphic Transfer (TT) Buying and Selling** rates across major Sri Lankan banks.

Built for **Netlify** (static frontend + serverless functions) with **Supabase** for historical storage. No always-on server, Docker, or VPS required.

## Features

- TT Buying / TT Selling for Seylan, HNB, Commercial Bank, Sampath, NDB, People's Bank, and BOC
- Currencies: USD, AUD, EUR, JPY, SGD (config-driven)
- Featured banks (Seylan · HNB · Commercial)
- Bank comparison + best buying / best selling highlights
- Intraday historical observations **plus** a guaranteed one-row-per-day snapshot
- History table + chart over 1D / 1W / 1M / 3M / 6M / 1Y / All
- Forecast panel: 1W / 2W / 1M / 3M / 6M lookback, trend + best/worst weekday, optional CBSL/Google signal and AI summary
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
4. Run [`supabase/migrations/002_daily_rates.sql`](supabase/migrations/002_daily_rates.sql) as well. It adds the `daily_rates` snapshot table and backfills it from any observations already stored, so existing history shows up in the long-range charts immediately.
5. Run [`supabase/migrations/003_reference_sources.sql`](supabase/migrations/003_reference_sources.sql) to seed CBSL and Google as forecast reference sources. Refresh also upserts those rows if this migration has not been applied yet.
6. Open **Project Settings → API** and copy:
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
| `GEMINI_API_KEY` | No | Free key (no card) from [Google AI Studio](https://aistudio.google.com/apikey) — enables AI-written Forecast summaries |
| `GROQ_API_KEY` | No | Free key (no card) from [Groq Console](https://console.groq.com/keys) — alternative AI-written Forecast summaries (Llama models). Used if `GEMINI_API_KEY` isn't set, or if `AI_PROVIDER=groq` |
| `AI_PROVIDER` | No | Force `gemini` or `groq` when both keys are set (default: tries Gemini first). Without any key, the Forecast panel still works, using a template-generated summary instead |
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
| `GET` | `/api/history?bank=SEYLAN&currency=USD&range=1d&date=2026-08-14` | Intraday history for one day |
| `GET` | `/api/history?bank=SEYLAN&currency=USD&range=1m` | Daily history (`1w`, `1m`, `3m`, `6m`, `1y`, `all`) |
| `GET` | `/api/forecast?bank=SEYLAN&currency=USD&range=1m&references=1` | Bank trend + optional CBSL/Google signal (`1w`, `2w`, `1m`, `3m`, `6m`) |
| `GET` | `/api/banks` | Bank config |
| `GET` | `/api/currencies` | Currency config |
| `POST` | `/api/refresh` | Fetch banks + store new observations |

---

## How history is stored

Two tables, two purposes:

| Table | Granularity | Written when |
|-------|-------------|--------------|
| `exchange_rates` | Every observation | First ever check, the first check of a new Colombo day, or whenever a rate moves |
| `daily_rates` | One row per bank + currency + day | Created on the first successful check of the day, then **updated in place** each time the rate moves that day |

Why both: `exchange_rates` answers "what happened during the day", `daily_rates` guarantees the long-range charts have exactly one point per day that was checked — including days where the rate never moved.

`daily_rates` also tracks `open_tt_buying` / `open_tt_selling` (first values of the day), `change_count` (how many times the rate moved), and `last_checked_at` (proof the day was checked even when nothing changed).

A repeated check within the same day with identical values writes no new observation; it only bumps `last_checked_at` and `observations` on the daily row.

**Gaps still mean "not collected".** Rates are only recorded when something actually runs, so a day with no scheduled refresh, no cron hit, and no manual refresh stays absent — nothing is back-filled or interpolated. Make sure the scheduled function is enabled on your deployed site (or an external cron hits `/api/refresh`) if you want unbroken daily history. See [Scheduled collection](#f-scheduled-collection).

If migration 002 hasn't been applied, `/api/history` still works: it collapses raw observations into a daily series and flags `dailySource: "observations"` in the response.

---

## Forecast methodology

`/api/forecast` computes the bank trend from stored daily snapshots (`daily_rates`, falling back to `exchange_rates`). Pick a lookback window in the UI or pass `range=1w|2w|1m|3m|6m` (default **1M** — long enough for a stable trend, short enough that a thin Google series does not dominate). `days=` still works and snaps to the nearest window.

When `references=1` (the UI default), it loads the **same window** of **CBSL official 9:30 a.m. TT** and **Google Finance mid** from the database, then qualifies the bank signal (spread vs official/mid, whether trends agree). CBSL is live-fetched only when stored coverage is too thin for that window. Google has no official history API, so the stored daily trend is used and today's mid is overlaid. The bank-only numbers stay unchanged if those sources fail.

Bank-only path (no paid API required):

1. Daily snapshots for the selected window are used as the series (one row per Colombo day).
2. With **3+ days** of history: a simple linear trend (least-squares regression) gives a direction (up/down/flat) and a naive next-day projection.
3. With **14+ days** of history: day-of-week averages become meaningful enough to surface a "historically best/worst day" signal (use 2W or longer).
4. Below 3 days, the panel honestly reports "not enough history yet" rather than guessing.
5. Optional CBSL + Google layer (uncheck in the Forecast panel, or pass `references=0`): compare that bank's latest TT and trend to CBSL's official buy/sell and Google's mid. Missing references never blank the bank forecast.

An optional `GEMINI_API_KEY` or `GROQ_API_KEY` (both free tier, no billing card — see [Environment variables](#2-environment-variables)) turns those numbers into a 2–3 sentence plain-English summary. If both are set, Gemini is tried first (override with `AI_PROVIDER=groq`); if a provider's request fails, it falls through to the next one, then to a template sentence built from the same numbers — the forecast itself never depends on the AI call succeeding, since numeric forecasting is done statistically and the AI is only used for narration. Use whichever free key you already have — anyone deploying this doesn't need Gemini specifically.

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
- Day-boundary storage rules (new day recorded even when unchanged; same-day repeats skipped)
- Daily series aggregation + range summaries

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
| History shows only one or two days | Those are the only days a refresh actually ran. Enable the scheduled function or an external cron on `/api/refresh` |
| Long ranges look sparse after upgrading | Run `supabase/migrations/002_daily_rates.sql`; it backfills `daily_rates` from existing observations |

---

## Notes / limitations

- Bank sites can change; each provider is isolated so fixes stay local.
- If a provider fails, the UI keeps the last valid rate and shows a stale/error indicator.
- HNB’s public API returns one buy/sell pair labelled as Telegraphic Transfer in their UI.
- Some banks may omit a currency on some days; missing values are not stored as zeros.
- Daily history only covers days on which a refresh ran; missed days are left empty rather than estimated.
- Rates are indicative — confirm with your bank before transacting.
