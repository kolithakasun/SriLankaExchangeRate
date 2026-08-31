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

export type NarrationSource = "gemini" | "groq" | "cursor" | "template";
export type AiProviderOption = "auto" | "gemini" | "groq" | "cursor";

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
  dailySource: "snapshot" | "observations" | null;
  points: HistoryPoint[];
  daily: DailyRatePoint[];
  summary: DailySeriesSummary | null;
  availableDates: string[];
}

export interface CursorQuota {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface CursorRunSummary {
  id: string;
  status: string;
  slot: number;
  agentId?: string | null;
  runId?: string | null;
  narration?: string | null;
  error?: string | null;
  completedAt?: string | null;
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
  generatedAt?: string;
  forecast: ForecastResult;
  narration: string;
  narrationSource: NarrationSource;
  narrationCached?: boolean;
  availableProviders: Array<"gemini" | "groq" | "cursor">;
  cursorPending?: boolean;
  cursorQuotaExhausted?: boolean;
  cursorRun?: CursorRunSummary;
  cursorQuota?: CursorQuota;
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

export interface CursorForecastStatusResponse {
  configured: boolean;
  cursorQuota: CursorQuota;
  availableProviders: Array<"gemini" | "groq" | "cursor">;
  cursorRun?: CursorRunSummary;
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

export interface AdminUser {
  id: string;
  email: string;
  role: "user" | "admin";
  disabled: boolean;
  created_at: string;
  updated_at: string;
}

async function api<T>(
  path: string,
  init?: RequestInit & { accessToken?: string | null },
): Promise<T> {
  const { accessToken, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(rest.headers ?? {}),
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
  provider?: AiProviderOption;
  references?: boolean;
  accessToken?: string | null;
}): Promise<ForecastResponse> {
  const provider =
    params.provider === "cursor" ? "auto" : params.provider;
  const q = new URLSearchParams({
    bank: params.bank,
    currency: params.currency,
    ...(params.range ? { range: params.range } : {}),
    ...(provider ? { provider } : {}),
    references: params.references === false ? "0" : "1",
  });
  return api(`/api/forecast?${q.toString()}`, {
    accessToken: params.accessToken,
  });
}

export function refreshForecast(params: {
  bank: string;
  currency: string;
  range?: ForecastRange;
  provider?: AiProviderOption;
  references?: boolean;
  token?: string;
  accessToken?: string | null;
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
    accessToken: params.accessToken,
    headers: params.token ? { "x-refresh-token": params.token } : {},
  });
}

export function fetchCursorForecastStatus(params: {
  accessToken: string;
  runId?: string;
}): Promise<CursorForecastStatusResponse> {
  const q = new URLSearchParams(
    params.runId ? { runId: params.runId } : undefined,
  );
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return api(`/api/cursor-forecast${suffix}`, {
    accessToken: params.accessToken,
  });
}

export function refreshRates(token?: string): Promise<RefreshResponse> {
  return api("/api/refresh", {
    method: "POST",
    headers: token ? { "x-refresh-token": token } : {},
  });
}

export function fetchAdminUsers(accessToken: string) {
  return api<{ users: AdminUser[] }>("/api/admin-users", { accessToken });
}

export function createAdminUser(
  accessToken: string,
  body: { email: string; password: string; role?: "user" | "admin" },
) {
  return api<{ user: AdminUser }>("/api/admin-users", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateAdminUser(
  accessToken: string,
  body: { id: string; role?: "user" | "admin"; disabled?: boolean },
) {
  return api<{ user: AdminUser }>("/api/admin-users", {
    method: "PATCH",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
