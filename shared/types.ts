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

export interface ForecastDailyPoint {
  date: string;
  closeBuying: number | null;
  closeSelling: number | null;
  minSelling: number | null;
  maxBuying: number | null;
  samples: number;
}

export interface ForecastPoint {
  date: string;
  predictedBuying: number | null;
  predictedSelling: number | null;
}

export interface ForecastAdvice {
  action: "buy_forex" | "sell_forex";
  recommendedDate: string | null;
  confidence: "low" | "medium" | "high";
  reason: string;
}

export interface ForecastResponse {
  bank: string;
  currency: string;
  lookbackDays: number;
  horizonDays: number;
  historyDaysAvailable: number;
  method: "trend_regression";
  dataQuality: "insufficient" | "limited" | "good";
  series: ForecastDailyPoint[];
  forecast: ForecastPoint[];
  advice: ForecastAdvice[];
}
