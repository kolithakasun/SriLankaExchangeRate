import { colomboDateKey } from "./time.js";
import type {
  DailyAggregate,
  DayOfWeekStat,
  ForecastResult,
  ForecastTrend,
  HistoryPoint,
} from "../types.js";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MIN_DAYS_FOR_TREND = 3;
const MIN_DAYS_FOR_SEASONALITY = 14;
const FLAT_THRESHOLD_PCT = 0.05;

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(value: number | null, decimals = 4): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Weekday (0=Sunday..6=Saturday) for a "yyyy-MM-dd" date key, timezone-independent. */
function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function groupByColomboDay(points: HistoryPoint[]): DailyAggregate[] {
  const buckets = new Map<
    string,
    { buying: number[]; selling: number[] }
  >();

  for (const point of points) {
    const key = colomboDateKey(point.retrievedAt);
    if (!buckets.has(key)) buckets.set(key, { buying: [], selling: [] });
    const bucket = buckets.get(key)!;
    if (point.ttBuying !== null) bucket.buying.push(point.ttBuying);
    if (point.ttSelling !== null) bucket.selling.push(point.ttSelling);
  }

  return [...buckets.entries()]
    .map(([date, { buying, selling }]) => ({
      date,
      avgBuying: round(mean(buying)),
      minBuying: buying.length ? Math.min(...buying) : null,
      maxBuying: buying.length ? Math.max(...buying) : null,
      avgSelling: round(mean(selling)),
      minSelling: selling.length ? Math.min(...selling) : null,
      maxSelling: selling.length ? Math.max(...selling) : null,
      samples: buying.length + selling.length,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Simple least-squares regression over x = 0..n-1. */
export function linearTrend(values: number[]): {
  slopePerDay: number;
  intercept: number;
} {
  const n = values.length;
  if (n < 2) return { slopePerDay: 0, intercept: values[0] ?? 0 };

  const xs = values.map((_, i) => i);
  const xMean = mean(xs)!;
  const yMean = mean(values)!;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }

  const slopePerDay = den === 0 ? 0 : num / den;
  const intercept = yMean - slopePerDay * xMean;
  return { slopePerDay, intercept };
}

export function dayOfWeekAverages(daily: DailyAggregate[]): DayOfWeekStat[] {
  const buckets = new Map<number, { buying: number[]; selling: number[] }>();

  for (const day of daily) {
    const weekday = weekdayOf(day.date);
    if (!buckets.has(weekday)) buckets.set(weekday, { buying: [], selling: [] });
    const bucket = buckets.get(weekday)!;
    if (day.avgBuying !== null) bucket.buying.push(day.avgBuying);
    if (day.avgSelling !== null) bucket.selling.push(day.avgSelling);
  }

  return Array.from({ length: 7 }, (_, weekday) => {
    const bucket = buckets.get(weekday);
    return {
      weekday,
      avgBuying: round(mean(bucket?.buying ?? [])),
      avgSelling: round(mean(bucket?.selling ?? [])),
      samples: bucket?.buying.length ?? 0,
    };
  });
}

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "Unknown";
}

function buildTrend(daily: DailyAggregate[]): ForecastTrend | null {
  const buyingSeries = daily
    .map((d) => d.avgBuying)
    .filter((v): v is number => v !== null);
  const sellingSeries = daily
    .map((d) => d.avgSelling)
    .filter((v): v is number => v !== null);

  if (buyingSeries.length < MIN_DAYS_FOR_TREND) return null;

  const { slopePerDay, intercept } = linearTrend(buyingSeries);
  const avg = mean(buyingSeries) ?? 0;
  const pctChangePerDay = avg === 0 ? 0 : (slopePerDay / avg) * 100;

  const direction: ForecastTrend["direction"] =
    Math.abs(pctChangePerDay) < FLAT_THRESHOLD_PCT
      ? "flat"
      : pctChangePerDay > 0
        ? "up"
        : "down";

  const projectedNextDayBuying = round(intercept + slopePerDay * buyingSeries.length);

  let projectedNextDaySelling: number | null = null;
  if (sellingSeries.length >= MIN_DAYS_FOR_TREND) {
    const sellingFit = linearTrend(sellingSeries);
    projectedNextDaySelling = round(
      sellingFit.intercept + sellingFit.slopePerDay * sellingSeries.length,
    );
  }

  return {
    direction,
    pctChangePerDay: round(pctChangePerDay, 3)!,
    projectedNextDayBuying,
    projectedNextDaySelling,
  };
}

function buildSuggestedAction(
  daysCovered: number,
  trend: ForecastTrend | null,
  bestDayOfWeek: DayOfWeekStat | null,
): string {
  if (!trend) {
    return `Only ${daysCovered} day${daysCovered === 1 ? "" : "s"} of history collected so far — check back once at least ${MIN_DAYS_FOR_TREND} days are available for a trend forecast.`;
  }

  let action: string;
  if (trend.direction === "up") {
    action = `TT buying rate has been rising (~${Math.abs(trend.pctChangePerDay).toFixed(2)}%/day over the last ${daysCovered} days). Rates may keep improving — worth waiting a little if your timing is flexible.`;
  } else if (trend.direction === "down") {
    action = `TT buying rate has been falling (~${Math.abs(trend.pctChangePerDay).toFixed(2)}%/day over the last ${daysCovered} days). Consider exchanging soon before it drops further.`;
  } else {
    action = `TT buying rate has been stable over the last ${daysCovered} days — no strong trend either way.`;
  }

  if (bestDayOfWeek) {
    action += ` Based on ${daysCovered} days of history, ${weekdayName(bestDayOfWeek.weekday)} has historically had the best average TT buying rate.`;
  }

  return action;
}

export function buildForecast(daily: DailyAggregate[]): ForecastResult {
  const daysCovered = daily.length;
  const confidence =
    daysCovered < MIN_DAYS_FOR_TREND
      ? "low"
      : daysCovered < MIN_DAYS_FOR_SEASONALITY
        ? "medium"
        : "high";

  const trend = buildTrend(daily);

  let bestDayOfWeek: DayOfWeekStat | null = null;
  let worstDayOfWeek: DayOfWeekStat | null = null;

  if (confidence === "high") {
    const stats = dayOfWeekAverages(daily).filter(
      (s) => s.samples > 0 && s.avgBuying !== null,
    );
    if (stats.length) {
      bestDayOfWeek = stats.reduce((a, b) => (b.avgBuying! > a.avgBuying! ? b : a));
      worstDayOfWeek = stats.reduce((a, b) => (b.avgBuying! < a.avgBuying! ? b : a));
    }
  }

  return {
    daysCovered,
    confidence,
    trend,
    bestDayOfWeek,
    worstDayOfWeek,
    suggestedAction: buildSuggestedAction(daysCovered, trend, bestDayOfWeek),
    daily,
  };
}
