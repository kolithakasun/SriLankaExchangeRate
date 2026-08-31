# Graph Report - SriLankaExchangeRate  (2026-08-31)

## Corpus Check
- 69 files · ~28,709 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 504 nodes · 1166 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c45cd33f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- providers/cbsl.ts
- shared/types.ts
- Dashboard.tsx
- store.ts
- functions/rates.ts
- scripts
- compilerOptions
- devDependencies
- compilerOptions
- backup-db.mjs
- tsconfig.json
- Sri Lanka Bank Exchange Rates
- backup-cron.sh
- copilot-instructions.md
- install-backup-cron.sh

## God Nodes (most connected - your core abstractions)
1. `nowIso()` - 20 edges
2. `colomboDateKey()` - 20 edges
3. `compilerOptions` - 19 edges
4. `Sri Lanka Bank Exchange Rates` - 18 edges
5. `getDailyHistory()` - 17 edges
6. `compilerOptions` - 16 edges
7. `handler` - 15 edges
8. `json()` - 15 edges
9. `handler` - 13 edges
10. `fetchGoogleMid()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `withLiveHistoryPoints()` --calls--> `nowIso()`  [EXTRACTED]
  netlify/functions/history.ts → shared/utils/time.ts
- `withLiveDailyHistory()` --calls--> `nowIso()`  [EXTRACTED]
  netlify/functions/history.ts → shared/utils/time.ts
- `loadGoogleDaily()` --calls--> `colomboDateKey()`  [EXTRACTED]
  netlify/functions/lib/forecast-references.ts → shared/utils/time.ts
- `PersistSummary` --references--> `ProviderResult`  [EXTRACTED]
  netlify/functions/lib/store.ts → shared/types.ts
- `persistWithSupabase()` --calls--> `nowIso()`  [EXTRACTED]
  netlify/functions/lib/store.ts → shared/utils/time.ts

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "providers/cbsl.ts"
Cohesion: 0.07
Nodes (67): overlayLiveReferenceRates(), PersistSummary, fetchHtmlProvider(), bocProvider, cbslProvider, chartFallback(), fetchCbslTtRows(), commercialProvider (+59 more)

### Community 1 - "shared/types.ts"
Cohesion: 0.06
Nodes (73): handler, buildPrompt(), geminiNarration(), getAvailableProviders(), groqNarration(), narrateForecast(), NarrationSource, PROVIDERS (+65 more)

### Community 2 - "Dashboard.tsx"
Cohesion: 0.06
Nodes (42): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, react, typescript (+34 more)

### Community 3 - "store.ts"
Cohesion: 0.08
Nodes (61): handler, withLiveDailyHistory(), withLiveHistoryPoints(), DailyOutcome, DailySnapshot, dailyTableAvailable(), ensureSourceRows(), getAvailableHistoryDates() (+53 more)

### Community 4 - "functions/rates.ts"
Cohesion: 0.17
Nodes (20): handler, handler, checkRefreshAllowed(), getClientIp(), handleOptions(), json(), refreshHits, wrap() (+12 more)

### Community 5 - "scripts"
Cohesion: 0.06
Nodes (32): cheerio, date-fns, date-fns-tz, dependencies, cheerio, date-fns, date-fns-tz, react (+24 more)

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
Cohesion: 0.06
Nodes (34): Bank source formats, Live provider check, Notes, 1. Supabase setup (do this first), 2. Environment variables, 3. Run locally, 4. Deploy to Netlify, A. Push to GitHub (+26 more)

### Community 13 - "backup-cron.sh"
Cohesion: 0.33
Nodes (7): cleanup_incomplete_dirs(), log(), prune_old_archives(), run_backup(), backup-cron.sh script, validate_dump(), write_status()

## Knowledge Gaps
- **139 isolated node(s):** `$schema`, `typescript`, `oxc`, `react/rules-of-hooks`, `warn` (+134 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `scripts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `colomboDateKey()` connect `store.ts` to `providers/cbsl.ts`, `shared/types.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `nowIso()` connect `providers/cbsl.ts` to `store.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `$schema`, `typescript`, `oxc` to the rest of the system?**
  _139 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `providers/cbsl.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0686641697877653 - nodes in this community are weakly interconnected._
- **Should `shared/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055651176133103844 - nodes in this community are weakly interconnected._
- **Should `Dashboard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06019871420222092 - nodes in this community are weakly interconnected._