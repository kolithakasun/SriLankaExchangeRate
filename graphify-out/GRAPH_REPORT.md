# Graph Report - SriLankaExchangeRate  (2026-08-31)

## Corpus Check
- 86 files · ~37,210 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 593 nodes · 1469 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a12779b6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- providers/cbsl.ts
- shared/types.ts
- api.ts
- store.ts
- forecast-payload.ts
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

## God Nodes (most connected - your core abstractions)
1. `nowIso()` - 26 edges
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

## Communities (17 total, 3 thin omitted)

### Community 0 - "providers/cbsl.ts"
Cohesion: 0.07
Nodes (66): overlayLiveReferenceRates(), PersistSummary, fetchHtmlProvider(), bocProvider, cbslProvider, chartFallback(), fetchCbslTtRows(), commercialProvider (+58 more)

### Community 1 - "shared/types.ts"
Cohesion: 0.05
Nodes (62): ForecastRequest, fetchCbslHistoryBounded(), loadCbslDaily(), loadForecastReferences(), loadGoogleDaily(), loadStoredDaily(), mergeDaily(), sortDaily() (+54 more)

### Community 2 - "api.ts"
Cohesion: 0.05
Nodes (59): react, BankRateCard(), BankStatusLine(), StatusDot(), BestRatesPanel(), ComparisonTable(), CurrencySelector(), ForecastPanel() (+51 more)

### Community 3 - "store.ts"
Cohesion: 0.07
Nodes (68): handler, withLiveDailyHistory(), withLiveHistoryPoints(), DailyOutcome, DailySnapshot, dailyTableAvailable(), ensureSourceRows(), getAvailableHistoryDates() (+60 more)

### Community 4 - "forecast-payload.ts"
Cohesion: 0.07
Nodes (67): handler, parseBody(), handler, handler, handler, handler, config, handler (+59 more)

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

## Knowledge Gaps
- **153 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+148 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `nowIso()` connect `store.ts` to `providers/cbsl.ts`, `forecast-payload.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `json()` connect `forecast-payload.ts` to `store.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `colomboDateKey()` connect `store.ts` to `providers/cbsl.ts`, `shared/types.ts`, `forecast-payload.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _153 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `providers/cbsl.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06741573033707865 - nodes in this community are weakly interconnected._
- **Should `shared/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05369369369369369 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05462962962962963 - nodes in this community are weakly interconnected._