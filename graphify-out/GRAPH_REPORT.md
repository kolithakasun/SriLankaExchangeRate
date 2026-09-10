# Graph Report - SriLankaExchangeRate  (2026-09-10)

## Corpus Check
- 91 files · ~39,364 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 613 nodes · 1535 edges · 24 communities (21 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `74524e87`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- shared/types.ts
- api.ts
- store.ts
- cursor-quota.ts
- scripts
- compilerOptions
- devDependencies
- compilerOptions
- backup-db.mjs
- tsconfig.json
- Sri Lanka Bank Exchange Rates
- backup-cron.sh
- plugins
- copilot-instructions.md
- install-backup-cron.sh
- utils/rates.ts
- providers/cbsl.ts
- time.ts
- binance-p2p.ts
- hnb.ts
- html.ts
- config/currencies.ts

## God Nodes (most connected - your core abstractions)
1. `nowIso()` - 28 edges
2. `json()` - 23 edges
3. `colomboDateKey()` - 23 edges
4. `compilerOptions` - 19 edges
5. `Sri Lanka Bank Exchange Rates` - 18 edges
6. `handler` - 17 edges
7. `getDailyHistory()` - 17 edges
8. `compilerOptions` - 16 edges
9. `getServiceClient()` - 15 edges
10. `buildForecastNumericPayload()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `handler` --calls--> `getEnabledBanks()`  [EXTRACTED]
  netlify/functions/banks.ts → shared/config/banks.ts
- `buildPrompt()` --calls--> `weekdayName()`  [EXTRACTED]
  netlify/functions/lib/ai.ts → shared/utils/forecast.ts
- `nextColomboMidnightIso()` --calls--> `colomboDateKey()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts
- `claimCursorQuotaSlot()` --calls--> `colomboDateKey()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts
- `markCursorRunPending()` --calls--> `nowIso()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts

## Import Cycles
- None detected.

## Communities (24 total, 3 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.24
Nodes (12): fetchHtmlProvider(), bocProvider, cbslProvider, commercialProvider, googleProvider, getProvider(), providers, ndbProvider (+4 more)

### Community 1 - "shared/types.ts"
Cohesion: 0.06
Nodes (71): buildForecastNumericPayload(), ForecastNumericPayload, ForecastRequest, fetchCbslHistoryBounded(), loadCbslDaily(), loadForecastReferences(), loadGoogleDaily(), loadStoredDaily() (+63 more)

### Community 2 - "api.ts"
Cohesion: 0.05
Nodes (59): react, BankRateCard(), BankStatusLine(), StatusDot(), BestRatesPanel(), ComparisonTable(), CurrencySelector(), ForecastPanel() (+51 more)

### Community 3 - "store.ts"
Cohesion: 0.09
Nodes (60): handler, withLiveDailyHistory(), withLiveHistoryPoints(), DailyOutcome, DailySnapshot, dailyTableAvailable(), ensureSourceRows(), getAvailableHistoryDates() (+52 more)

### Community 4 - "cursor-quota.ts"
Cohesion: 0.08
Nodes (63): handler, parseBody(), handler, handler, handler, config, handler, buildPrompt() (+55 more)

### Community 5 - "scripts"
Cohesion: 0.06
Nodes (34): cheerio, @cursor/sdk, date-fns, date-fns-tz, dependencies, cheerio, @cursor/sdk, date-fns (+26 more)

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (27): DOM, DOM.Iterable, ES2022, shared/*, src, vite/client, compilerOptions, allowImportingTsExtensions (+19 more)

### Community 7 - "devDependencies"
Cohesion: 0.09
Nodes (23): concurrently, @netlify/functions, devDependencies, concurrently, @netlify/functions, tailwindcss, @tailwindcss/vite, @types/node (+15 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): ES2023, node, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection (+12 more)

### Community 9 - "backup-db.mjs"
Cohesion: 0.32
Nodes (11): BACKUP_TABLES, backupLocalStore(), backupSupabase(), fetchAll(), loadEnvFile(), localStorePath(), main(), parseArgs() (+3 more)

### Community 12 - "Sri Lanka Bank Exchange Rates"
Cohesion: 0.05
Nodes (37): Bank source formats, Live provider check, Notes, 1. Supabase setup (do this first), 2. Environment variables, 3. Run locally, 4. Deploy to Netlify, A. Push to GitHub (+29 more)

### Community 13 - "backup-cron.sh"
Cohesion: 0.33
Nodes (7): cleanup_incomplete_dirs(), log(), prune_old_archives(), run_backup(), backup-cron.sh script, validate_dump(), write_status()

### Community 14 - "plugins"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 17 - "utils/rates.ts"
Cohesion: 0.21
Nodes (15): fetchGoogleMid(), getCurrency(), ExchangeRate, StoredRate, GOOGLE_FINANCE_QUOTE_URL, googleFinanceQuoteUrl(), parseGoogleFinanceMid(), filterValidRates() (+7 more)

### Community 18 - "providers/cbsl.ts"
Cohesion: 0.21
Nodes (18): chartFallback(), fetchCbslTtRows(), supportedCurrencyCodes, CBSL_CHART_BASE_URL, CBSL_TT_FORM_URL, CBSL_TT_FORM_VALUES, CBSL_TT_RESULTS_URL, cbslChartUrl() (+10 more)

### Community 19 - "time.ts"
Cohesion: 0.23
Nodes (9): SampathPayload, sampathProvider, SampathRow, COLOMBO_TZ, pad(), parseSourceTimestamp(), toColombo(), toColomboDate() (+1 more)

### Community 20 - "binance-p2p.ts"
Cohesion: 0.20
Nodes (11): BinanceAdv, binanceP2pProvider, BinanceSearchResponse, searchPrices(), BybitItem, BybitOnlineResponse, bybitP2pProvider, BINANCE_BANK_SRI_LANKA (+3 more)

### Community 21 - "hnb.ts"
Cohesion: 0.17
Nodes (6): PersistSummary, HnbLastUpdate, hnbProvider, HnbRateRow, HnbRatesPayload, ProviderResult

### Community 22 - "html.ts"
Cohesion: 0.36
Nodes (8): CURRENCY_ALIASES, expandRowCells(), extractSourceTimestampFromHtml(), findTtColumnIndexes(), headerScore(), HtmlTableParseOptions, normalizeCurrencyLabel(), parseTtRatesFromHtmlTables()

### Community 23 - "config/currencies.ts"
Cohesion: 0.43
Nodes (5): handler, currencies, DEFAULT_CURRENCY, getEnabledCurrencies(), CurrencyConfig

## Knowledge Gaps
- **158 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+153 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `nowIso()` connect `store.ts` to `index.ts`, `shared/types.ts`, `cursor-quota.ts`, `utils/rates.ts`, `providers/cbsl.ts`, `time.ts`, `binance-p2p.ts`, `hnb.ts`, `html.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `json()` connect `cursor-quota.ts` to `shared/types.ts`, `store.ts`, `config/currencies.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `colomboDateKey()` connect `store.ts` to `shared/types.ts`, `providers/cbsl.ts`, `time.ts`, `cursor-quota.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _158 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `shared/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05789009697325889 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05462962962962963 - nodes in this community are weakly interconnected._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0877431026684758 - nodes in this community are weakly interconnected._