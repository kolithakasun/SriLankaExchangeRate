import { ratesEqual } from "./rates.js";
import { colomboDateKey } from "./time.js";
import type { DailyRatePoint, HistoryPoint } from "../types.js";

/**
 * Collapses intraday observations into one point per Colombo day.
 *
 * Used as the fallback when the `daily_rates` snapshot table is unavailable, and
 * to derive the daily series from a local dev store.
 */
export function toDailySeries(points: HistoryPoint[]): DailyRatePoint[] {
  const byDate = new Map<string, HistoryPoint[]>();

  for (const point of points) {
    const key = colomboDateKey(point.retrievedAt);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(point);
    else byDate.set(key, [point]);
  }

  const days: DailyRatePoint[] = [];

  for (const [date, bucket] of byDate) {
    const ordered = [...bucket].sort((a, b) =>
      a.retrievedAt < b.retrievedAt ? -1 : 1,
    );
    const open = ordered[0];
    const close = ordered[ordered.length - 1];

    let changeCount = 0;
    let lastChangedAt = open.retrievedAt;
    for (let i = 1; i < ordered.length; i++) {
      if (!ratesEqual(ordered[i - 1], ordered[i])) {
        changeCount += 1;
        lastChangedAt = ordered[i].retrievedAt;
      }
    }

    days.push({
      date,
      ttBuying: close.ttBuying,
      ttSelling: close.ttSelling,
      openTtBuying: open.ttBuying,
      openTtSelling: open.ttSelling,
      sourceTimestamp: close.sourceTimestamp ?? null,
      firstSeenAt: open.retrievedAt,
      lastCheckedAt: close.retrievedAt,
      lastChangedAt,
      changeCount,
      observations: ordered.length,
    });
  }

  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface DailySeriesSummary {
  days: number;
  firstDate: string | null;
  lastDate: string | null;
  highBuying: number | null;
  lowBuying: number | null;
  highSelling: number | null;
  lowSelling: number | null;
  /** Net move of TT buying from the first to the last day in the series. */
  netBuyingChange: number | null;
  netSellingChange: number | null;
}

export function summarizeDailySeries(daily: DailyRatePoint[]): DailySeriesSummary {
  const buying = daily
    .map((d) => d.ttBuying)
    .filter((v): v is number => v !== null);
  const selling = daily
    .map((d) => d.ttSelling)
    .filter((v): v is number => v !== null);

  const round = (value: number) => Number(value.toFixed(4));

  return {
    days: daily.length,
    firstDate: daily[0]?.date ?? null,
    lastDate: daily[daily.length - 1]?.date ?? null,
    highBuying: buying.length ? Math.max(...buying) : null,
    lowBuying: buying.length ? Math.min(...buying) : null,
    highSelling: selling.length ? Math.max(...selling) : null,
    lowSelling: selling.length ? Math.min(...selling) : null,
    netBuyingChange:
      buying.length > 1 ? round(buying[buying.length - 1] - buying[0]) : null,
    netSellingChange:
      selling.length > 1 ? round(selling[selling.length - 1] - selling[0]) : null,
  };
}

/** Colombo date key N days before today (0 = today). */
export function colomboDateKeyDaysAgo(days: number, from: Date = new Date()): string {
  const shifted = new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
  return colomboDateKey(shifted);
}
