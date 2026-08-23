export type BankCode =
  | "SEYLAN"
  | "HNB"
  | "COMMERCIAL"
  | "SAMPATH"
  | "NDB"
  | "PEOPLES"
  | "BOC"
  | "CBSL"
  | "GOOGLE";

/** Licensed banks vs official/market references used for forecast signals. */
export type SourceKind = "bank" | "reference";

export type ReferenceSourceId = "CBSL" | "GOOGLE";

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
  /** Defaults to "bank". Reference sources are collected but hidden from comparison UI. */
  kind?: SourceKind;
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

export type HistoryRange = "1d" | "1w" | "1m" | "3m" | "6m" | "1y" | "all";

/** Windows offered on the Forecast panel. Default is 1m. */
export type ForecastRange = "1w" | "2w" | "1m" | "3m" | "6m";

/**
 * One row per bank/currency/Colombo day. Created on the first check of the day
 * (even when rates match yesterday) and updated in place when rates move.
 */
export interface DailyRatePoint {
  /** Colombo calendar date, "yyyy-MM-dd". */
  date: string;
  /** Latest values seen on that day. */
  ttBuying: number | null;
  ttSelling: number | null;
  /** First values seen on that day. */
  openTtBuying: number | null;
  openTtSelling: number | null;
  sourceTimestamp: string | null;
  firstSeenAt: string | null;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  /** How many times the rate moved during the day. */
  changeCount: number;
  observations: number;
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
  /** Dates actually compared; the previous day may be older than yesterday if a day was missed. */
  todayDate?: string | null;
  previousDate?: string | null;
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

export type ReferenceQuoteKind = "tt" | "mid";

export type TrendAlignment = "aligned" | "diverging" | "unknown";

export interface ReferenceSeriesView {
  source: ReferenceSourceId;
  label: string;
  quoteKind: ReferenceQuoteKind;
  latestDate: string | null;
  latestBuying: number | null;
  latestSelling: number | null;
  daysCovered: number;
  trend: ForecastTrend | null;
}

export interface BankVsReference {
  source: ReferenceSourceId;
  label: string;
  quoteKind: ReferenceQuoteKind;
  /** Bank TT buying minus reference buying (or mid). */
  buyingSpread: number | null;
  /** Bank TT selling minus reference selling (or mid). */
  sellingSpread: number | null;
  referenceDate: string | null;
  bankDate: string | null;
  alignment: TrendAlignment;
}

export interface ForecastReferences {
  cbsl: ReferenceSeriesView | null;
  google: ReferenceSeriesView | null;
  comparisons: BankVsReference[];
  combinedSignal: string;
  errors: Partial<Record<ReferenceSourceId, string>>;
}

export interface ForecastResult {
  daysCovered: number;
  confidence: ForecastConfidence;
  trend: ForecastTrend | null;
  bestDayOfWeek: DayOfWeekStat | null;
  worstDayOfWeek: DayOfWeekStat | null;
  suggestedAction: string;
  daily: DailyAggregate[];
  /** Present only when the forecast was requested with CBSL/Google references. */
  references?: ForecastReferences;
}
