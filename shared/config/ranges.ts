import type { ForecastRange, HistoryRange } from "../types.js";

export interface HistoryRangeConfig {
  value: HistoryRange;
  label: string;
  /** Calendar days of history to load, counting today. */
  days: number;
  description: string;
}

/** "all" is capped so range queries always stay bounded. */
export const MAX_RANGE_DAYS = 3650;

export const historyRanges: HistoryRangeConfig[] = [
  { value: "1d", label: "1D", days: 1, description: "Intraday observations" },
  { value: "1w", label: "1W", days: 7, description: "Last 7 days" },
  { value: "1m", label: "1M", days: 30, description: "Last 30 days" },
  { value: "3m", label: "3M", days: 90, description: "Last 3 months" },
  { value: "6m", label: "6M", days: 180, description: "Last 6 months" },
  { value: "1y", label: "1Y", days: 365, description: "Last 12 months" },
  { value: "all", label: "All", days: MAX_RANGE_DAYS, description: "Everything stored" },
];

export const DEFAULT_RANGE: HistoryRange = "1m";

export function isHistoryRange(value: string): value is HistoryRange {
  return historyRanges.some((r) => r.value === value);
}

export function getRangeDays(range: HistoryRange): number {
  return historyRanges.find((r) => r.value === range)?.days ?? 30;
}

export function getRange(range: string): HistoryRangeConfig | undefined {
  return historyRanges.find((r) => r.value === range);
}

export interface ForecastRangeConfig {
  value: ForecastRange;
  label: string;
  days: number;
  description: string;
}

/**
 * Forecast windows. 1M is the default: long enough for a stable trend,
 * short enough that a stale Google series does not dominate. 1Y/All use
 * everything stored; CBSL live-fill is capped at 1 year.
 */
export const forecastRanges: ForecastRangeConfig[] = [
  { value: "1w", label: "1W", days: 7, description: "Last 7 days" },
  { value: "2w", label: "2W", days: 14, description: "Last 14 days" },
  { value: "1m", label: "1M", days: 30, description: "Last 30 days" },
  { value: "3m", label: "3M", days: 90, description: "Last 3 months" },
  { value: "6m", label: "6M", days: 180, description: "Last 6 months" },
  { value: "1y", label: "1Y", days: 365, description: "Last 12 months" },
  { value: "all", label: "All", days: MAX_RANGE_DAYS, description: "Everything stored" },
];

export const DEFAULT_FORECAST_RANGE: ForecastRange = "1m";

export function isForecastRange(value: string): value is ForecastRange {
  return forecastRanges.some((r) => r.value === value);
}

export function getForecastRangeDays(range: ForecastRange): number {
  return forecastRanges.find((r) => r.value === range)?.days ?? 30;
}

export function getForecastRange(
  range: string,
): ForecastRangeConfig | undefined {
  return forecastRanges.find((r) => r.value === range);
}

export function resolveForecastWindow(params: {
  range?: string;
  days?: string;
}): { range: ForecastRange; days: number } {
  const rawRange = params.range?.toLowerCase() ?? "";
  if (isForecastRange(rawRange)) {
    return { range: rawRange, days: getForecastRangeDays(rawRange) };
  }

  const requested = Number(params.days);
  if (Number.isFinite(requested) && requested > 0) {
    const match = forecastRanges.reduce((best, current) =>
      Math.abs(current.days - requested) < Math.abs(best.days - requested)
        ? current
        : best,
    );
    return { range: match.value, days: match.days };
  }

  return {
    range: DEFAULT_FORECAST_RANGE,
    days: getForecastRangeDays(DEFAULT_FORECAST_RANGE),
  };
}
