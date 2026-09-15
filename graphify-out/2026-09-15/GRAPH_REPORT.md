# Graph Report - SriLankaExchangeRate  (2026-09-15)

## Corpus Check
- 93 files · ~41,161 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 632 nodes · 1568 edges · 29 communities (24 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7abbded4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- providers/cbsl.ts
- shared/types.ts
- api.ts
- store.ts
- cursor-quota.ts
- dependencies
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
- main.tsx
- contact.ts
- scripts
- ComparisonTable.tsx
- Dashboard.tsx
- AuthContext.tsx
- config/currencies.ts
- ContactFab.tsx
- HistorySection.tsx
- package.json
- @types/react
- typescript

## God Nodes (most connected - your core abstractions)
1. `nowIso()` - 28 edges
2. `json()` - 25 edges
3. `colomboDateKey()` - 23 edges
4. `compilerOptions` - 19 edges
5. `Sri Lanka Bank Exchange Rates` - 18 edges
6. `handler` - 17 edges
7. `getDailyHistory()` - 17 edges
8. `compilerOptions` - 16 edges
9. `getServiceClient()` - 15 edges
10. `buildForecastNumericPayload()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `PersistSummary` --references--> `ProviderResult`  [EXTRACTED]
  netlify/functions/lib/store.ts → shared/types.ts
- `handler` --calls--> `getEnabledBanks()`  [EXTRACTED]
  netlify/functions/banks.ts → shared/config/banks.ts
- `buildPrompt()` --calls--> `weekdayName()`  [EXTRACTED]
  netlify/functions/lib/ai.ts → shared/utils/forecast.ts
- `nextColomboMidnightIso()` --calls--> `colomboDateKey()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts
- `claimCursorQuotaSlot()` --calls--> `colomboDateKey()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts

## Import Cycles
- None detected.

## Communities (29 total, 5 thin omitted)

### Community 0 - "providers/cbsl.ts"
Cohesion: 0.05
Nodes (80): checkRefreshAllowed(), persistProviderResults(), fetchHtmlProvider(), BinanceAdv, binanceP2pProvider, BinanceSearchResponse, searchPrices(), bocProvider (+72 more)

### Community 1 - "shared/types.ts"
Cohesion: 0.06
Nodes (67): buildForecastNumericPayload(), ForecastNumericPayload, ForecastRequest, fetchCbslHistoryBounded(), loadCbslDaily(), loadForecastReferences(), loadGoogleDaily(), loadStoredDaily() (+59 more)

### Community 2 - "api.ts"
Cohesion: 0.16
Nodes (19): ForecastPanel(), PROVIDER_LABELS, ReferenceSignalsCard(), signed(), trendLabel(), AiProviderOption, api(), CursorForecastStatusResponse (+11 more)

### Community 3 - "store.ts"
Cohesion: 0.08
Nodes (67): handler, withLiveDailyHistory(), withLiveHistoryPoints(), overlayLiveReferenceRates(), DailyOutcome, DailySnapshot, dailyTableAvailable(), ensureSourceRows() (+59 more)

### Community 4 - "cursor-quota.ts"
Cohesion: 0.09
Nodes (56): handler, parseBody(), handler, handler, handler, config, handler, buildPrompt() (+48 more)

### Community 5 - "dependencies"
Cohesion: 0.11
Nodes (19): cheerio, @cursor/sdk, date-fns, date-fns-tz, dependencies, cheerio, @cursor/sdk, date-fns (+11 more)

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (27): DOM, DOM.Iterable, ES2022, shared/*, src, vite/client, compilerOptions, allowImportingTsExtensions (+19 more)

### Community 7 - "devDependencies"
Cohesion: 0.11
Nodes (19): concurrently, @netlify/functions, devDependencies, concurrently, @netlify/functions, tailwindcss, @tailwindcss/vite, @types/node (+11 more)

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

### Community 17 - "main.tsx"
Cohesion: 0.19
Nodes (14): react, ProtectedRoute(), ThemeToggle(), useAuth(), AdminUsers(), onCreate(), setUserRole(), toggleDisabled() (+6 more)

### Community 18 - "contact.ts"
Cohesion: 0.24
Nodes (11): CONTACT_SUBJECTS, ContactBody, contactHits, ContactSubject, handler, isValidEmail(), sendWithResend(), sendWithWeb3Forms() (+3 more)

### Community 19 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:backup, db:backup:cron, dev, lint, netlify:dev, preview (+3 more)

### Community 20 - "ComparisonTable.tsx"
Cohesion: 0.29
Nodes (6): BankRateCard(), BankStatusLine(), StatusDot(), ComparisonTable(), rateChange(), RateValue()

### Community 21 - "Dashboard.tsx"
Cohesion: 0.31
Nodes (6): BestRatesPanel(), CurrencySelector(), useRates(), fetchRates(), RatesResponse, refreshRates()

### Community 22 - "AuthContext.tsx"
Cohesion: 0.31
Nodes (8): AppRole, AuthContext, AuthContextValue, AuthProfile, AuthProvider(), loadProfile(), getBrowserSupabase(), isAuthConfigured()

### Community 23 - "config/currencies.ts"
Cohesion: 0.18
Nodes (7): handler, currencies, DEFAULT_CURRENCY, getCurrency(), getEnabledCurrencies(), CurrencyConfig, formatRate()

### Community 24 - "ContactFab.tsx"
Cohesion: 0.29
Nodes (5): ContactFab(), onSubmit(), emptyForm, SUBJECTS, submitContact()

### Community 25 - "HistorySection.tsx"
Cohesion: 0.43
Nodes (6): changeClass(), formatSigned(), HistorySection(), load(), fetchHistory(), HistoryResponse

### Community 26 - "package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

## Knowledge Gaps
- **166 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+161 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `json()` connect `cursor-quota.ts` to `providers/cbsl.ts`, `contact.ts`, `store.ts`, `config/currencies.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `nowIso()` connect `store.ts` to `providers/cbsl.ts`, `shared/types.ts`, `cursor-quota.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `colomboDateKey()` connect `store.ts` to `providers/cbsl.ts`, `shared/types.ts`, `cursor-quota.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _166 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `providers/cbsl.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05261336102457598 - nodes in this community are weakly interconnected._
- **Should `shared/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061175666438824335 - nodes in this community are weakly interconnected._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08035087719298245 - nodes in this community are weakly interconnected._