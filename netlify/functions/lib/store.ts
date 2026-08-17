import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { banks, getBankByCode } from "../../../shared/config/banks.js";
import { currencies } from "../../../shared/config/currencies.js";
import { decideObservation, ratesEqual } from "../../../shared/utils/rates.js";
import {
  colomboDateKeyDaysAgo,
  toDailySeries,
} from "../../../shared/utils/history.js";
import { colomboDateKey, nowIso } from "../../../shared/utils/time.js";
import type {
  BankStatus,
  DailyRatePoint,
  ExchangeRate,
  HistoryPoint,
  LatestRateView,
  ProviderResult,
  StoredRate,
} from "../../../shared/types.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** Daily snapshot keyed by bank + currency + Colombo date. */
type DailySnapshot = {
  bankCode: string;
  currency: string;
  date: string;
  ttBuying: number | null;
  ttSelling: number | null;
  openTtBuying: number | null;
  openTtSelling: number | null;
  sourceTimestamp: string | null;
  firstSeenAt: string;
  lastCheckedAt: string;
  lastChangedAt: string | null;
  changeCount: number;
  observations: number;
};

type LocalStore = {
  rates: Array<StoredRate & { id: string; createdAt: string }>;
  status: Record<string, BankStatus>;
  daily?: Record<string, DailySnapshot>;
};

export interface PersistSummary {
  inserted: number;
  checked: number;
  /** Daily snapshot rows created (one per bank/currency/day). */
  dailyCreated: number;
  /** Daily snapshot rows whose rates moved during the day. */
  dailyUpdated: number;
  results: ProviderResult[];
}

function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function localStorePath(): string {
  const dir = join(tmpdir(), "sl-exchange-rates");
  mkdirSync(dir, { recursive: true });
  return join(dir, "store.json");
}

function readLocal(): LocalStore {
  const path = localStorePath();
  if (!existsSync(path)) {
    return { rates: [], status: {}, daily: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as LocalStore;
    return { ...parsed, daily: parsed.daily ?? {} };
  } catch {
    return { rates: [], status: {}, daily: {} };
  }
}

function writeLocal(store: LocalStore): void {
  writeFileSync(localStorePath(), JSON.stringify(store, null, 2));
}

function statusFromTimestamps(status: Partial<BankStatus>): BankStatus["status"] {
  if (status.lastError && !status.lastSuccessAt) return "error";
  if (!status.lastSuccessAt) return "unknown";
  const ageMs = Date.now() - new Date(status.lastSuccessAt).getTime();
  const staleAfter = (Number(process.env.RATE_REFRESH_INTERVAL ?? 30) * 2 + 15) * 60_000;
  if (status.lastError || ageMs > staleAfter) return "stale";
  return "ok";
}

export function usingSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * `daily_rates` ships in migration 002, so a database that has only run 001 must
 * keep working. We remember the miss for a few minutes instead of retrying on
 * every rate of every refresh.
 */
const MISSING_TABLE_RETRY_MS = 5 * 60_000;
let dailyTableMissingSince: number | null = null;

function dailyTableAvailable(): boolean {
  if (dailyTableMissingSince === null) return true;
  if (Date.now() - dailyTableMissingSince > MISSING_TABLE_RETRY_MS) {
    dailyTableMissingSince = null;
    return true;
  }
  return false;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /could not find the table|does not exist|schema cache/i.test(message)
  );
}

function noteMissingDailyTable(context: string): void {
  if (dailyTableMissingSince === null) {
    console.warn(
      `daily_rates table not found (${context}). Run supabase/migrations/002_daily_rates.sql to enable the daily history snapshot; falling back to aggregating observations.`,
    );
  }
  dailyTableMissingSince = Date.now();
}

export async function persistProviderResults(
  results: ProviderResult[],
): Promise<PersistSummary> {
  const client = getServiceClient();
  if (client) {
    return persistWithSupabase(client, results);
  }
  return persistWithLocal(results);
}

async function persistWithSupabase(
  client: SupabaseClient,
  results: ProviderResult[],
): Promise<PersistSummary> {
  let inserted = 0;
  let checked = 0;
  let dailyCreated = 0;
  let dailyUpdated = 0;

  for (const result of results) {
    checked += 1;
    const checkedAt = result.retrievedAt || nowIso();

    if (!result.success || !result.rates.length) {
      await client.from("bank_status").upsert({
        bank_code: result.bankCode,
        last_checked_at: checkedAt,
        last_error: result.error ?? "Provider failed",
        updated_at: nowIso(),
      });
      continue;
    }

    let changedAt: string | null = null;

    for (const rate of result.rates) {
      const dateKey = colomboDateKey(rate.retrievedAt);

      const { data: latest } = await client
        .from("exchange_rates")
        .select("tt_buying, tt_selling, retrieved_at")
        .eq("bank_code", rate.bankCode)
        .eq("currency_code", rate.currency)
        .order("retrieved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const decision = decideObservation({
        previous: latest
          ? {
              ttBuying: numberOrNull(latest.tt_buying),
              ttSelling: numberOrNull(latest.tt_selling),
              dateKey: colomboDateKey(latest.retrieved_at as string),
            }
          : null,
        current: { ttBuying: rate.ttBuying, ttSelling: rate.ttSelling },
        dateKey,
      });

      if (decision.record) {
        const { error } = await client.from("exchange_rates").insert({
          bank_code: rate.bankCode,
          currency_code: rate.currency,
          tt_buying: rate.ttBuying,
          tt_selling: rate.ttSelling,
          source_timestamp: rate.sourceTimestamp ?? null,
          retrieved_at: rate.retrievedAt,
          source: getBankByCode(String(rate.bankCode))?.sourceUrl ?? null,
          raw_reference: rate.rawReference ?? null,
          parser_version: rate.parserVersion ?? null,
        });
        if (error) {
          console.error("Insert failed", rate.bankCode, rate.currency, error.message);
        } else {
          inserted += 1;
          if (decision.reason === "changed") changedAt = checkedAt;
        }
      }

      const outcome = await upsertDailySnapshot(client, rate, dateKey, checkedAt);
      if (outcome === "created") dailyCreated += 1;
      if (outcome === "changed") {
        dailyUpdated += 1;
        changedAt = checkedAt;
      }
    }

    await client.from("bank_status").upsert({
      bank_code: result.bankCode,
      last_checked_at: checkedAt,
      last_success_at: checkedAt,
      last_error: null,
      ...(changedAt ? { last_changed_at: changedAt } : {}),
      updated_at: nowIso(),
    });
  }

  return { inserted, checked, dailyCreated, dailyUpdated, results };
}

type DailyOutcome = "created" | "changed" | "touched" | "skipped";

/**
 * Keeps exactly one `daily_rates` row per bank/currency/day: created on the first
 * check of the day even when the rate matches yesterday, then updated in place
 * whenever the rate moves later that day.
 */
async function upsertDailySnapshot(
  client: SupabaseClient,
  rate: ExchangeRate,
  dateKey: string,
  checkedAt: string,
  isRetry = false,
): Promise<DailyOutcome> {
  if (!dailyTableAvailable()) return "skipped";

  const { data: existing, error: selectError } = await client
    .from("daily_rates")
    .select("id, tt_buying, tt_selling, change_count, observations")
    .eq("bank_code", rate.bankCode)
    .eq("currency_code", rate.currency)
    .eq("rate_date", dateKey)
    .maybeSingle();

  if (selectError) {
    if (isMissingTable(selectError)) {
      noteMissingDailyTable("select");
      return "skipped";
    }
    console.error("Daily snapshot read failed", rate.bankCode, selectError.message);
    return "skipped";
  }

  if (!existing) {
    const { error } = await client.from("daily_rates").insert({
      bank_code: rate.bankCode,
      currency_code: rate.currency,
      rate_date: dateKey,
      tt_buying: rate.ttBuying,
      tt_selling: rate.ttSelling,
      open_tt_buying: rate.ttBuying,
      open_tt_selling: rate.ttSelling,
      source_timestamp: rate.sourceTimestamp ?? null,
      first_seen_at: rate.retrievedAt,
      last_checked_at: checkedAt,
      last_changed_at: rate.retrievedAt,
      change_count: 0,
      observations: 1,
      parser_version: rate.parserVersion ?? null,
      updated_at: nowIso(),
    });

    if (error) {
      if (isMissingTable(error)) {
        noteMissingDailyTable("insert");
        return "skipped";
      }
      // A concurrent refresh may have created the row first; fall through to update.
      if (error.code === "23505" && !isRetry) {
        return upsertDailySnapshot(client, rate, dateKey, checkedAt, true);
      }
      console.error("Daily snapshot insert failed", rate.bankCode, error.message);
      return "skipped";
    }
    return "created";
  }

  const moved = !ratesEqual(
    {
      ttBuying: numberOrNull(existing.tt_buying),
      ttSelling: numberOrNull(existing.tt_selling),
    },
    { ttBuying: rate.ttBuying, ttSelling: rate.ttSelling },
  );

  const patch: Record<string, unknown> = {
    last_checked_at: checkedAt,
    observations: Number(existing.observations ?? 1) + 1,
    updated_at: nowIso(),
  };

  if (moved) {
    patch.tt_buying = rate.ttBuying;
    patch.tt_selling = rate.ttSelling;
    patch.source_timestamp = rate.sourceTimestamp ?? null;
    patch.last_changed_at = rate.retrievedAt;
    patch.change_count = Number(existing.change_count ?? 0) + 1;
    patch.parser_version = rate.parserVersion ?? null;
  }

  const { error: updateError } = await client
    .from("daily_rates")
    .update(patch)
    .eq("id", existing.id as string);

  if (updateError) {
    console.error("Daily snapshot update failed", rate.bankCode, updateError.message);
    return "skipped";
  }

  return moved ? "changed" : "touched";
}

function persistWithLocal(results: ProviderResult[]): PersistSummary {
  const store = readLocal();
  const daily = store.daily ?? {};
  let inserted = 0;
  let checked = 0;
  let dailyCreated = 0;
  let dailyUpdated = 0;

  for (const result of results) {
    checked += 1;
    const checkedAt = result.retrievedAt || nowIso();
    const prev = store.status[result.bankCode] ?? {
      bankCode: result.bankCode,
      lastCheckedAt: null,
      lastChangedAt: null,
      lastSuccessAt: null,
      lastError: null,
      status: "unknown" as const,
    };

    if (!result.success || !result.rates.length) {
      store.status[result.bankCode] = {
        ...prev,
        bankCode: result.bankCode,
        lastCheckedAt: checkedAt,
        lastError: result.error ?? "Provider failed",
        status: statusFromTimestamps({
          ...prev,
          lastCheckedAt: checkedAt,
          lastError: result.error ?? "Provider failed",
        }),
      };
      continue;
    }

    let changed = false;
    for (const rate of result.rates) {
      const dateKey = colomboDateKey(rate.retrievedAt);
      const latest = store.rates
        .filter((r) => r.bankCode === rate.bankCode && r.currency === rate.currency)
        .sort((a, b) => (a.retrievedAt < b.retrievedAt ? 1 : -1))[0];

      const decision = decideObservation({
        previous: latest
          ? {
              ttBuying: latest.ttBuying,
              ttSelling: latest.ttSelling,
              dateKey: colomboDateKey(latest.retrievedAt),
            }
          : null,
        current: { ttBuying: rate.ttBuying, ttSelling: rate.ttSelling },
        dateKey,
      });

      if (decision.record) {
        store.rates.push({
          id: crypto.randomUUID(),
          bankCode: String(rate.bankCode),
          currency: rate.currency,
          ttBuying: rate.ttBuying,
          ttSelling: rate.ttSelling,
          sourceTimestamp: rate.sourceTimestamp ?? null,
          retrievedAt: rate.retrievedAt,
          parserVersion: rate.parserVersion,
          rawReference: rate.rawReference,
          createdAt: nowIso(),
        });
        inserted += 1;
        if (decision.reason === "changed") changed = true;
      }

      const key = `${rate.bankCode}:${rate.currency}:${dateKey}`;
      const snapshot = daily[key];

      if (!snapshot) {
        daily[key] = {
          bankCode: String(rate.bankCode),
          currency: rate.currency,
          date: dateKey,
          ttBuying: rate.ttBuying,
          ttSelling: rate.ttSelling,
          openTtBuying: rate.ttBuying,
          openTtSelling: rate.ttSelling,
          sourceTimestamp: rate.sourceTimestamp ?? null,
          firstSeenAt: rate.retrievedAt,
          lastCheckedAt: checkedAt,
          lastChangedAt: rate.retrievedAt,
          changeCount: 0,
          observations: 1,
        };
        dailyCreated += 1;
      } else {
        const moved = !ratesEqual(snapshot, {
          ttBuying: rate.ttBuying,
          ttSelling: rate.ttSelling,
        });
        snapshot.lastCheckedAt = checkedAt;
        snapshot.observations += 1;
        if (moved) {
          snapshot.ttBuying = rate.ttBuying;
          snapshot.ttSelling = rate.ttSelling;
          snapshot.sourceTimestamp = rate.sourceTimestamp ?? null;
          snapshot.lastChangedAt = rate.retrievedAt;
          snapshot.changeCount += 1;
          dailyUpdated += 1;
          changed = true;
        }
      }
    }

    store.status[result.bankCode] = {
      bankCode: result.bankCode,
      lastCheckedAt: checkedAt,
      lastChangedAt: changed ? checkedAt : prev.lastChangedAt,
      lastSuccessAt: checkedAt,
      lastError: null,
      status: "ok",
    };
  }

  store.daily = daily;
  writeLocal(store);
  return { inserted, checked, dailyCreated, dailyUpdated, results };
}

export async function getLatestRates(filters?: {
  bank?: string;
  currency?: string;
}): Promise<LatestRateView[]> {
  const client = getServiceClient();
  if (client) return getLatestFromSupabase(client, filters);
  return getLatestFromLocal(filters);
}

async function getLatestFromSupabase(
  client: SupabaseClient,
  filters?: { bank?: string; currency?: string },
): Promise<LatestRateView[]> {
  const { data: statusRows } = await client.from("bank_status").select("*");
  const statusMap = new Map(
    (statusRows ?? []).map((s) => [
      s.bank_code as string,
      {
        bankCode: s.bank_code as string,
        lastCheckedAt: s.last_checked_at as string | null,
        lastChangedAt: s.last_changed_at as string | null,
        lastSuccessAt: s.last_success_at as string | null,
        lastError: s.last_error as string | null,
        status: statusFromTimestamps({
          lastSuccessAt: s.last_success_at,
          lastError: s.last_error,
        }),
      } satisfies BankStatus,
    ]),
  );

  let query = client
    .from("exchange_rates")
    .select("*")
    .order("retrieved_at", { ascending: false })
    .limit(2000);

  if (filters?.bank) query = query.eq("bank_code", filters.bank.toUpperCase());
  if (filters?.currency) {
    query = query.eq("currency_code", filters.currency.toUpperCase());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const latestKey = new Map<string, (typeof data)[number]>();
  const previousKey = new Map<string, (typeof data)[number]>();

  for (const row of data ?? []) {
    const key = `${row.bank_code}:${row.currency_code}`;
    if (!latestKey.has(key)) {
      latestKey.set(key, row);
    } else if (!previousKey.has(key)) {
      previousKey.set(key, row);
    }
  }

  const enabledBanks = banks.filter((b) => b.enabled);
  const views: LatestRateView[] = [];

  for (const bank of enabledBanks) {
    if (filters?.bank && bank.code !== filters.bank.toUpperCase()) continue;
    const currenciesToShow = filters?.currency
      ? [filters.currency.toUpperCase()]
      : currencies.filter((c) => c.enabled).map((c) => c.code);

    for (const currency of currenciesToShow) {
      const key = `${bank.code}:${currency}`;
      const latest = latestKey.get(key);
      const previous = previousKey.get(key);
      const status = statusMap.get(bank.code);

      views.push({
        bankCode: bank.code,
        bankName: bank.name,
        shortName: bank.shortName,
        featured: bank.featured,
        priority: bank.priority,
        currency,
        ttBuying: latest ? numberOrNull(latest.tt_buying) : null,
        ttSelling: latest ? numberOrNull(latest.tt_selling) : null,
        sourceTimestamp: (latest?.source_timestamp as string | null) ?? null,
        retrievedAt: (latest?.retrieved_at as string | null) ?? null,
        lastCheckedAt: status?.lastCheckedAt ?? null,
        lastChangedAt: status?.lastChangedAt ?? null,
        lastSuccessAt: status?.lastSuccessAt ?? null,
        lastError: status?.lastError ?? null,
        status: status?.status ?? (latest ? "ok" : "unknown"),
        previousTtBuying: previous ? numberOrNull(previous.tt_buying) : null,
        previousTtSelling: previous ? numberOrNull(previous.tt_selling) : null,
      });
    }
  }

  return views.sort((a, b) => a.priority - b.priority);
}

function getLatestFromLocal(filters?: {
  bank?: string;
  currency?: string;
}): LatestRateView[] {
  const store = readLocal();
  const enabledBanks = banks.filter((b) => b.enabled);
  const views: LatestRateView[] = [];

  for (const bank of enabledBanks) {
    if (filters?.bank && bank.code !== filters.bank.toUpperCase()) continue;
    const currenciesToShow = filters?.currency
      ? [filters.currency.toUpperCase()]
      : currencies.filter((c) => c.enabled).map((c) => c.code);

    for (const currency of currenciesToShow) {
      const rows = store.rates
        .filter((r) => r.bankCode === bank.code && r.currency === currency)
        .sort((a, b) => (a.retrievedAt < b.retrievedAt ? 1 : -1));
      const latest = rows[0];
      const previous = rows[1];
      const status = store.status[bank.code];

      views.push({
        bankCode: bank.code,
        bankName: bank.name,
        shortName: bank.shortName,
        featured: bank.featured,
        priority: bank.priority,
        currency,
        ttBuying: latest?.ttBuying ?? null,
        ttSelling: latest?.ttSelling ?? null,
        sourceTimestamp: latest?.sourceTimestamp ?? null,
        retrievedAt: latest?.retrievedAt ?? null,
        lastCheckedAt: status?.lastCheckedAt ?? null,
        lastChangedAt: status?.lastChangedAt ?? null,
        lastSuccessAt: status?.lastSuccessAt ?? null,
        lastError: status?.lastError ?? null,
        status: status?.status ?? (latest ? "ok" : "unknown"),
        previousTtBuying: previous?.ttBuying ?? null,
        previousTtSelling: previous?.ttSelling ?? null,
      });
    }
  }

  return views.sort((a, b) => a.priority - b.priority);
}

export async function getHistory(options: {
  bank: string;
  currency: string;
  date: string;
}): Promise<HistoryPoint[]> {
  const client = getServiceClient();
  if (client) {
    const start = `${options.date}T00:00:00+05:30`;
    const endDate = new Date(`${options.date}T00:00:00+05:30`);
    endDate.setDate(endDate.getDate() + 1);
    const end = endDate.toISOString();

    const { data, error } = await client
      .from("exchange_rates")
      .select("*")
      .eq("bank_code", options.bank.toUpperCase())
      .eq("currency_code", options.currency.toUpperCase())
      .gte("retrieved_at", new Date(start).toISOString())
      .lt("retrieved_at", end)
      .order("retrieved_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map(mapObservationRow);
  }

  const store = readLocal();
  return store.rates
    .filter(
      (r) =>
        r.bankCode === options.bank.toUpperCase() &&
        r.currency === options.currency.toUpperCase() &&
        colomboDateKey(r.retrievedAt) === options.date,
    )
    .sort((a, b) => (a.retrievedAt > b.retrievedAt ? 1 : -1))
    .map(mapLocalRow);
}

export async function getHistoryRange(options: {
  bank: string;
  currency: string;
  days: number;
}): Promise<HistoryPoint[]> {
  const cutoff = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000).toISOString();
  const client = getServiceClient();

  if (client) {
    const { data, error } = await client
      .from("exchange_rates")
      .select("*")
      .eq("bank_code", options.bank.toUpperCase())
      .eq("currency_code", options.currency.toUpperCase())
      .gte("retrieved_at", cutoff)
      .order("retrieved_at", { ascending: true })
      .limit(5000);

    if (error) throw new Error(error.message);

    return (data ?? []).map(mapObservationRow);
  }

  const store = readLocal();
  return store.rates
    .filter(
      (r) =>
        r.bankCode === options.bank.toUpperCase() &&
        r.currency === options.currency.toUpperCase() &&
        r.retrievedAt >= cutoff,
    )
    .sort((a, b) => (a.retrievedAt > b.retrievedAt ? 1 : -1))
    .map(mapLocalRow);
}

/**
 * Daily series for long ranges (1 week … 1 year). Reads the `daily_rates`
 * snapshot when available and otherwise collapses raw observations, so the
 * endpoint works before migration 002 has been applied.
 */
export async function getDailyHistory(options: {
  bank: string;
  currency: string;
  days: number;
}): Promise<{ daily: DailyRatePoint[]; source: "snapshot" | "observations" }> {
  const bank = options.bank.toUpperCase();
  const currency = options.currency.toUpperCase();
  const client = getServiceClient();

  if (client && dailyTableAvailable()) {
    const from = colomboDateKeyDaysAgo(Math.max(options.days - 1, 0));
    const { data, error } = await client
      .from("daily_rates")
      .select("*")
      .eq("bank_code", bank)
      .eq("currency_code", currency)
      .gte("rate_date", from)
      .order("rate_date", { ascending: true })
      .limit(2000);

    if (error) {
      if (isMissingTable(error)) {
        noteMissingDailyTable("history");
      } else {
        console.error("Daily history read failed", error.message);
      }
    } else if (data && data.length) {
      return { daily: data.map(mapDailyRow), source: "snapshot" };
    }
  }

  const points = await getHistoryRange({ bank, currency, days: options.days });
  return { daily: toDailySeries(points), source: "observations" };
}

export async function getAvailableHistoryDates(options: {
  bank: string;
  currency: string;
}): Promise<string[]> {
  const client = getServiceClient();
  if (client) {
    const { data, error } = await client
      .from("exchange_rates")
      .select("retrieved_at")
      .eq("bank_code", options.bank.toUpperCase())
      .eq("currency_code", options.currency.toUpperCase())
      .order("retrieved_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    const dates = new Set(
      (data ?? []).map((r) => colomboDateKey(r.retrieved_at as string)),
    );
    return [...dates];
  }

  const store = readLocal();
  const dates = new Set(
    store.rates
      .filter(
        (r) =>
          r.bankCode === options.bank.toUpperCase() &&
          r.currency === options.currency.toUpperCase(),
      )
      .map((r) => colomboDateKey(r.retrievedAt)),
  );
  return [...dates].sort((a, b) => (a < b ? 1 : -1));
}

function mapObservationRow(row: Record<string, unknown>): HistoryPoint {
  return {
    id: row.id as string,
    bankCode: row.bank_code as string,
    currency: row.currency_code as string,
    ttBuying: numberOrNull(row.tt_buying),
    ttSelling: numberOrNull(row.tt_selling),
    sourceTimestamp: (row.source_timestamp as string | null) ?? null,
    retrievedAt: row.retrieved_at as string,
    createdAt: row.created_at as string,
  };
}

function mapLocalRow(row: StoredRate & { id: string; createdAt: string }): HistoryPoint {
  return {
    id: row.id,
    bankCode: row.bankCode as string,
    currency: row.currency,
    ttBuying: row.ttBuying,
    ttSelling: row.ttSelling,
    sourceTimestamp: row.sourceTimestamp ?? null,
    retrievedAt: row.retrievedAt,
    createdAt: row.createdAt,
  };
}

function mapDailyRow(row: Record<string, unknown>): DailyRatePoint {
  return {
    date: String(row.rate_date).slice(0, 10),
    ttBuying: numberOrNull(row.tt_buying),
    ttSelling: numberOrNull(row.tt_selling),
    openTtBuying: numberOrNull(row.open_tt_buying),
    openTtSelling: numberOrNull(row.open_tt_selling),
    sourceTimestamp: (row.source_timestamp as string | null) ?? null,
    firstSeenAt: (row.first_seen_at as string | null) ?? null,
    lastCheckedAt: (row.last_checked_at as string | null) ?? null,
    lastChangedAt: (row.last_changed_at as string | null) ?? null,
    changeCount: Number(row.change_count ?? 0),
    observations: Number(row.observations ?? 0),
  };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
