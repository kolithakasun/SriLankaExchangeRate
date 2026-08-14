export type BankCode =
  | "SEYLAN"
  | "HNB"
  | "COMMERCIAL"
  | "SAMPATH"
  | "NDB"
  | "PEOPLES"
  | "BOC";

export type CurrencyCode = "USD" | "AUD" | "EUR" | "JPY" | "SGD" | string;

export interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  symbol: string;
  enabled: boolean;
  /** Preferred decimal places for display; null = preserve source precision */
  decimals: number | null;
}

export interface BankConfig {
  code: BankCode;
  name: string;
  shortName: string;
  priority: number;
  enabled: boolean;
  featured: boolean;
  sourceUrl: string;
  provider: string;
}

export interface ExchangeRate {
  bankCode: BankCode | string;
  currency: CurrencyCode;
  ttBuying: number | null;
  ttSelling: number | null;
  sourceTimestamp?: string | null;
  retrievedAt: string;
  parserVersion?: string;
  rawReference?: string;
}

export interface ProviderResult {
  bankCode: BankCode | string;
  success: boolean;
  rates: ExchangeRate[];
  error?: string;
  retrievedAt: string;
  sourceTimestamp?: string | null;
}

export interface BankStatus {
  bankCode: string;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  status: "ok" | "stale" | "error" | "unknown";
}

export interface StoredRate extends ExchangeRate {
  id?: string;
  source?: string;
  createdAt?: string;
}

export interface LatestRateView {
  bankCode: string;
  bankName: string;
  shortName: string;
  featured: boolean;
  priority: number;
  currency: string;
  ttBuying: number | null;
  ttSelling: number | null;
  sourceTimestamp: string | null;
  retrievedAt: string | null;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  status: BankStatus["status"];
  previousTtBuying?: number | null;
  previousTtSelling?: number | null;
}

export interface HistoryPoint {
  id?: string;
  bankCode: string;
  currency: string;
  ttBuying: number | null;
  ttSelling: number | null;
  sourceTimestamp: string | null;
  retrievedAt: string;
  createdAt?: string;
}

export interface BestRates {
  currency: string;
  bestBuying: {
    bankCode: string;
    bankName: string;
    rate: number;
  } | null;
  bestSelling: {
    bankCode: string;
    bankName: string;
    rate: number;
  } | null;
}

export interface DayComparison {
  currency: string;
  bankCode?: string;
  todayBuying: number | null;
  yesterdayBuying: number | null;
  buyingChange: number | null;
  todaySelling: number | null;
  yesterdaySelling: number | null;
  sellingChange: number | null;
}

export interface DailyAggregate {
  date: string;
  avgBuying: number | null;
  minBuying: number | null;
  maxBuying: number | null;
  avgSelling: number | null;
  minSelling: number | null;
  maxSelling: number | null;
  samples: number;
}

export type ForecastConfidence = "low" | "medium" | "high";

export interface DayOfWeekStat {
  weekday: number;
  avgBuying: number | null;
  avgSelling: number | null;
  samples: number;
}

export interface ForecastTrend {
  direction: "up" | "down" | "flat";
  pctChangePerDay: number;
  projectedNextDayBuying: number | null;
  projectedNextDaySelling: number | null;
}

export interface ForecastResult {
  daysCovered: number;
  confidence: ForecastConfidence;
  trend: ForecastTrend | null;
  bestDayOfWeek: DayOfWeekStat | null;
  worstDayOfWeek: DayOfWeekStat | null;
  suggestedAction: string;
  daily: DailyAggregate[];
}
