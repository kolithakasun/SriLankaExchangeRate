# Graph Report - SriLankaExchangeRate  (2026-08-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 442 nodes · 1080 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `272fb76b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10

## God Nodes (most connected - your core abstractions)
1. `nowIso()` - 19 edges
2. `colomboDateKey()` - 19 edges
3. `compilerOptions` - 19 edges
4. `getDailyHistory()` - 17 edges
5. `compilerOptions` - 16 edges
6. `json()` - 15 edges
7. `handler` - 13 edges
8. `handler` - 13 edges
9. `BankExchangeRateProvider` - 12 edges
10. `ProviderResult` - 12 edges

## Surprising Connections (you probably didn't know these)
- `PersistSummary` --references--> `ProviderResult`  [EXTRACTED]
  netlify/functions/lib/store.ts → shared/types.ts
- `fetchHtmlProvider()` --calls--> `getBankByCode()`  [EXTRACTED]
  netlify/functions/providers/base.ts → shared/config/banks.ts
- `fetchCbslTtRows()` --calls--> `colomboDateKey()`  [EXTRACTED]
  netlify/functions/providers/cbsl.ts → shared/utils/time.ts
- `getDailyHistory()` --calls--> `colomboDateKeyDaysAgo()`  [EXTRACTED]
  netlify/functions/lib/store.ts → shared/utils/history.ts
- `withLiveDailyHistory()` --calls--> `nowIso()`  [EXTRACTED]
  netlify/functions/history.ts → shared/utils/time.ts

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (66): overlayLiveReferenceRates(), fetchHtmlProvider(), bocProvider, cbslProvider, chartFallback(), fetchCbslHistory(), fetchCbslTtRows(), commercialProvider (+58 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (66): handler, buildPrompt(), geminiNarration(), getAvailableProviders(), groqNarration(), narrateForecast(), NarrationSource, PROVIDERS (+58 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (41): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, react, warn (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (43): handler, withLiveDailyHistory(), withLiveHistoryPoints(), DailyOutcome, DailySnapshot, dailyTableAvailable(), ensureSourceRows(), getAvailableHistoryDates() (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (39): handler, handler, checkRefreshAllowed(), getClientIp(), handleOptions(), json(), refreshHits, wrap() (+31 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (31): cheerio, date-fns, date-fns-tz, dependencies, cheerio, date-fns, date-fns-tz, react (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (27): DOM, DOM.Iterable, ES2022, shared/*, src, vite/client, compilerOptions, allowImportingTsExtensions (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (23): concurrently, @netlify/functions, devDependencies, concurrently, @netlify/functions, tailwindcss, @tailwindcss/vite, @types/node (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (20): ES2023, node, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.32
Nodes (11): BACKUP_TABLES, backupLocalStore(), backupSupabase(), fetchAll(), loadEnvFile(), localStorePath(), main(), parseArgs() (+3 more)

## Knowledge Gaps
- **105 isolated node(s):** `HnbLastUpdate`, `HnbRateRow`, `HnbRatesPayload`, `SampathPayload`, `SampathRow` (+100 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Community 7` to `Community 5`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `plugins` connect `Community 2` to `Community 7`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `typescript` connect `Community 7` to `Community 2`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `HnbLastUpdate`, `HnbRateRow`, `HnbRatesPayload` to the rest of the system?**
  _105 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07001044932079414 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06049213943950786 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06328320802005012 - nodes in this community are weakly interconnected._