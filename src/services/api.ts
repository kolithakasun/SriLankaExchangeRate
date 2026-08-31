import type {
  BestRates,
  DailyRatePoint,
  DayComparison,
  ForecastRange,
  ForecastResult,
  HistoryPoint,
  HistoryRange,
  LatestRateView,
} from "@shared/types";
import type { DailySeriesSummary } from "@shared/utils/history";

export interface RatesResponse {
  currency: string;
  bank: string | null;
  storage: string;
  lastCheckedAt: string | null;
  rates: LatestRateView[];
  references?: LatestRateView[];
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
  mode: "day" | "range";
  range: HistoryRange;
  date: string;
  days: number;
  storage: string;
  /** Whether the daily series came from the snapshot table or raw observations. */
  dailySource: "snapshot" | "observations" | null;
  points: HistoryPoint[];
  daily: DailyRatePoint[];
  summary: DailySeriesSummary | null;
  availableDates: string[];
}

export interface ForecastResponse {
  bank: string;
  currency: string;
  storage: string;
  range?: ForecastRange;
  days?: number;
  daysAnalyzed: number;
  confidence: ForecastResult["confidence"];
  includeReferences?: boolean;
  /** When this forecast was computed on the server. */
  generatedAt?: string;
  forecast: ForecastResult;
  narration: string;
  narrationSource: "gemini" | "groq" | "template";
  availableProviders: Array<"gemini" | "groq">;
}

export interface ForecastRefreshResponse extends ForecastResponse {
  ok: boolean;
  collection: {
    checked: number;
    inserted: number;
    dailyCreated?: number;
    dailyUpdated?: number;
    failed: Array<{ bankCode: string; error: string | null }>;
  };
}

export interface RefreshResponse {
  ok: boolean;
  storage: string;
  checked: number;
  inserted: number;
  dailyCreated?: number;
  dailyUpdated?: number;
  results: Array<{
    bankCode: string;
    success: boolean;
    currencies: string[];
    error: string | null;
    retrievedAt: string;
  }>;
  error?: string;
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
  range: HistoryRange;
  date?: string;
}): Promise<HistoryResponse> {
  const q = new URLSearchParams({
    bank: params.bank,
    currency: params.currency,
    range: params.range,
    ...(params.date ? { date: params.date } : {}),
  });
  return api(`/api/history?${q.toString()}`);
}

export function fetchForecast(params: {
  bank: string;
  currency: string;
  range?: ForecastRange;
  provider?: "auto" | "gemini" | "groq";
  references?: boolean;
}): Promise<ForecastResponse> {
  const q = new URLSearchParams({
    bank: params.bank,
    currency: params.currency,
    ...(params.range ? { range: params.range } : {}),
    ...(params.provider ? { provider: params.provider } : {}),
    references: params.references === false ? "0" : "1",
  });
  return api(`/api/forecast?${q.toString()}`);
}

export function refreshForecast(params: {
  bank: string;
  currency: string;
  range?: ForecastRange;
  provider?: "auto" | "gemini" | "groq";
  references?: boolean;
  token?: string;
}): Promise<ForecastRefreshResponse> {
  const q = new URLSearchParams({
    bank: params.bank,
    currency: params.currency,
    ...(params.range ? { range: params.range } : {}),
    ...(params.provider ? { provider: params.provider } : {}),
    references: params.references === false ? "0" : "1",
  });
  return api(`/api/forecast-refresh?${q.toString()}`, {
    method: "POST",
    headers: params.token ? { "x-refresh-token": params.token } : {},
  });
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
