import type { HistoryRange } from "../types.js";

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
