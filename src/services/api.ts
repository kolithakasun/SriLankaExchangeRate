import type {
  BestRates,
  DayComparison,
  ForecastResponse,
  HistoryPoint,
  LatestRateView,
} from "@shared/types";

export interface RatesResponse {
  currency: string;
  bank: string | null;
  storage: string;
  lastCheckedAt: string | null;
  rates: LatestRateView[];
  best: BestRates;
  dayComparison: DayComparison;
  banks: Array<{
    code: string;
    name: string;
    shortName: string;
    featured: boolean;
    priority: number;
    sourceUrl: string;
  }>;
}

export interface HistoryResponse {
  bank: string;
  currency: string;
  date: string;
  storage: string;
  points: HistoryPoint[];
  availableDates: string[];
}

export interface RefreshResponse {
  ok: boolean;
  storage: string;
  checked: number;
  inserted: number;
  results: Array<{
    bankCode: string;
    success: boolean;
    currencies: string[];
    error: string | null;
    retrievedAt: string;
  }>;
  error?: string;
}

export interface ForecastQuery {
  bank?: string;
  currency: string;
  window?: number;
  horizon?: number;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function fetchRates(currency: string): Promise<RatesResponse> {
  return api(`/api/rates?currency=${encodeURIComponent(currency)}`);
}

export function fetchHistory(params: {
  bank: string;
  currency: string;
  date: string;
}): Promise<HistoryResponse> {
  const q = new URLSearchParams(params);
  return api(`/api/history?${q.toString()}`);
}

export function refreshRates(token?: string): Promise<RefreshResponse> {
  return api("/api/refresh", {
    method: "POST",
    headers: token ? { "x-refresh-token": token } : {},
  });
}

export function fetchBanks() {
  return api<{ banks: RatesResponse["banks"] }>("/api/banks");
}

export function fetchForecast(query: ForecastQuery): Promise<ForecastResponse> {
  const params = new URLSearchParams({ currency: query.currency });
  if (query.bank) params.set("bank", query.bank);
  if (query.window) params.set("window", String(query.window));
  if (query.horizon) params.set("horizon", String(query.horizon));
  return api(`/api/forecast?${params.toString()}`);
}

export function fetchCurrencies() {
  return api<{
    currencies: Array<{
      code: string;
      name: string;
      symbol: string;
      enabled: boolean;
      decimals: number | null;
    }>;
  }>("/api/currencies");
}
