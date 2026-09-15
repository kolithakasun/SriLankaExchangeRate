# Graph Report - SriLankaExchangeRate  (2026-09-15)

## Corpus Check
- 94 files · ~41,636 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 636 nodes · 1578 edges · 24 communities (19 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1f8fdada`
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
- contact.ts
- scripts
- ComparisonTable.tsx
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
- `handler` --calls--> `getEnabledBanks()`  [EXTRACTED]
  netlify/functions/banks.ts → shared/config/banks.ts
- `nextColomboMidnightIso()` --calls--> `colomboDateKey()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts
- `claimCursorQuotaSlot()` --calls--> `colomboDateKey()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts
- `markCursorRunPending()` --calls--> `nowIso()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts
- `completeCursorRun()` --calls--> `nowIso()`  [EXTRACTED]
  netlify/functions/lib/cursor-quota.ts → shared/utils/time.ts

## Import Cycles
- None detected.

## Communities (24 total, 5 thin omitted)

### Community 0 - "providers/cbsl.ts"
Cohesion: 0.06
Nodes (78): overlayLiveReferenceRates(), PersistSummary, fetchHtmlProvider(), BinanceAdv, binanceP2pProvider, BinanceSearchResponse, searchPrices(), bocProvider (+70 more)

### Community 1 - "shared/types.ts"
Cohesion: 0.05
Nodes (77): buildPrompt(), geminiNarration(), groqNarration(), narrateForecast(), NarrationSource, PROVIDERS, referencePromptBlock(), SyncNarrationSource (+69 more)

### Community 2 - "api.ts"
Cohesion: 0.05
Nodes (60): react, BestRatesPanel(), BrandLogo(), BrandLogoProps, ContactFab(), onSubmit(), emptyForm, SUBJECTS (+52 more)

### Community 3 - "store.ts"
Cohesion: 0.08
Nodes (67): handler, withLiveDailyHistory(), withLiveHistoryPoints(), DailyOutcome, DailySnapshot, dailyTableAvailable(), ensureSourceRows(), getAvailableHistoryDates() (+59 more)

### Community 4 - "cursor-quota.ts"
Cohesion: 0.09
Nodes (55): handler, parseBody(), handler, handler, handler, handler, config, handler (+47 more)

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

### Community 18 - "contact.ts"
Cohesion: 0.24
Nodes (11): CONTACT_SUBJECTS, ContactBody, contactHits, ContactSubject, handler, isValidEmail(), sendWithResend(), sendWithWeb3Forms() (+3 more)

### Community 19 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:backup, db:backup:cron, dev, lint, netlify:dev, preview (+3 more)

### Community 20 - "ComparisonTable.tsx"
Cohesion: 0.29
Nodes (6): BankRateCard(), BankStatusLine(), StatusDot(), ComparisonTable(), rateChange(), RateValue()

### Community 26 - "package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

## Knowledge Gaps
- **167 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `json()` connect `cursor-quota.ts` to `contact.ts`, `store.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `nowIso()` connect `store.ts` to `providers/cbsl.ts`, `shared/types.ts`, `cursor-quota.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `colomboDateKey()` connect `store.ts` to `providers/cbsl.ts`, `shared/types.ts`, `cursor-quota.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `providers/cbsl.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0564240790655885 - nodes in this community are weakly interconnected._
- **Should `shared/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05303030303030303 - nodes in this community are weakly interconnected._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05450165612767239 - nodes in this community are weakly interconnected._