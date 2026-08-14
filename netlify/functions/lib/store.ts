import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { banks } from "../../../shared/config/banks.js";
import { currencies } from "../../../shared/config/currencies.js";
import { ratesEqual } from "../../../shared/utils/rates.js";
import { colomboDateKey, nowIso } from "../../../shared/utils/time.js";
import type {
  BankStatus,
  HistoryPoint,
  LatestRateView,
  ProviderResult,
  StoredRate,
} from "../../../shared/types.js";
import { getBankByCode } from "../../../shared/config/banks.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

type LocalStore = {
  rates: Array<StoredRate & { id: string; createdAt: string }>;
  status: Record<string, BankStatus>;
};

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
    return { rates: [], status: {} };
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LocalStore;
  } catch {
    return { rates: [], status: {} };
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

export async function persistProviderResults(
  results: ProviderResult[],
): Promise<{ inserted: number; checked: number; results: ProviderResult[] }> {
  const client = getServiceClient();
  if (client) {
    return persistWithSupabase(client, results);
  }
  return persistWithLocal(results);
}

async function persistWithSupabase(
  client: SupabaseClient,
  results: ProviderResult[],
): Promise<{ inserted: number; checked: number; results: ProviderResult[] }> {
  let inserted = 0;
  let checked = 0;

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

    for (const rate of result.rates) {
      const { data: latest } = await client
        .from("exchange_rates")
        .select("tt_buying, tt_selling")
        .eq("bank_code", rate.bankCode)
        .eq("currency_code", rate.currency)
        .order("retrieved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const unchanged =
        latest &&
        ratesEqual(
          {
            ttBuying: latest.tt_buying === null ? null : Number(latest.tt_buying),
            ttSelling: latest.tt_selling === null ? null : Number(latest.tt_selling),
          },
          { ttBuying: rate.ttBuying, ttSelling: rate.ttSelling },
        );

      if (!unchanged) {
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
          await client.from("bank_status").upsert({
            bank_code: result.bankCode,
            last_checked_at: checkedAt,
            last_changed_at: checkedAt,
            last_success_at: checkedAt,
            last_error: null,
            updated_at: nowIso(),
          });
        }
      } else {
        await client.from("bank_status").upsert({
          bank_code: result.bankCode,
          last_checked_at: checkedAt,
          last_success_at: checkedAt,
          last_error: null,
          updated_at: nowIso(),
        });
      }
    }
  }

  return { inserted, checked, results };
}

function persistWithLocal(
  results: ProviderResult[],
): { inserted: number; checked: number; results: ProviderResult[] } {
  const store = readLocal();
  let inserted = 0;
  let checked = 0;

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
      const latest = store.rates
        .filter((r) => r.bankCode === rate.bankCode && r.currency === rate.currency)
        .sort((a, b) => (a.retrievedAt < b.retrievedAt ? 1 : -1))[0];

      if (
        latest &&
        ratesEqual(latest, { ttBuying: rate.ttBuying, ttSelling: rate.ttSelling })
      ) {
        continue;
      }

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
      changed = true;
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

  writeLocal(store);
  return { inserted, checked, results };
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

    return (data ?? []).map((row) => ({
      id: row.id as string,
      bankCode: row.bank_code as string,
      currency: row.currency_code as string,
      ttBuying: numberOrNull(row.tt_buying),
      ttSelling: numberOrNull(row.tt_selling),
      sourceTimestamp: row.source_timestamp as string | null,
      retrievedAt: row.retrieved_at as string,
      createdAt: row.created_at as string,
    }));
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
    .map((r) => ({
      id: r.id,
      bankCode: r.bankCode,
      currency: r.currency,
      ttBuying: r.ttBuying,
      ttSelling: r.ttSelling,
      sourceTimestamp: r.sourceTimestamp ?? null,
      retrievedAt: r.retrievedAt,
      createdAt: r.createdAt,
    }));
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

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
