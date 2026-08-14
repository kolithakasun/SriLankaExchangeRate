import type {
  BestRates,
  DayComparison,
  ForecastResult,
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

export interface ForecastResponse {
  bank: string;
  currency: string;
  storage: string;
  daysAnalyzed: number;
  confidence: ForecastResult["confidence"];
  forecast: ForecastResult;
  narration: string;
  narrationSource: "gemini" | "groq" | "template";
  availableProviders: Array<"gemini" | "groq">;
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

export function fetchForecast(params: {
  bank: string;
  currency: string;
  provider?: "auto" | "gemini" | "groq";
}): Promise<ForecastResponse> {
  const q = new URLSearchParams({
    bank: params.bank,
    currency: params.currency,
    ...(params.provider ? { provider: params.provider } : {}),
  });
  return api(`/api/forecast?${q.toString()}`);
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
