import { colomboDateKey } from "./time.js";
import type {
  BankVsReference,
  DailyAggregate,
  DailyRatePoint,
  DayOfWeekStat,
  ForecastAssumptions,
  ForecastReferences,
  ForecastResult,
  ForecastTrend,
  HistoryPoint,
  ReferenceQuoteKind,
  ReferenceSeriesView,
  ReferenceSourceId,
  TrendAlignment,
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
const ASSUMPTION_HALF_LIFE_DAYS = 90;
const ASSUMPTION_BANK_WEIGHT = 0.3;
const ASSUMPTION_CBSL_WEIGHT = 0.7;

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

const CBSL_MIN_STORED_DAYS = 3;

/**
 * Prefer stored CBSL daily rows. Live official history is only needed when
 * the DB is thinner than ~30% of expected weekdays in the window.
 */
export function cbslStoredCoverageIsEnough(
  storedDays: number,
  requestedDays: number,
): boolean {
  if (storedDays < CBSL_MIN_STORED_DAYS) return false;
  const expectedWeekdays = Math.floor((requestedDays * 5) / 7);
  const threshold = Math.max(
    CBSL_MIN_STORED_DAYS,
    Math.floor(expectedWeekdays * 0.3),
  );
  return storedDays >= threshold;
}

/** Snapshot table rows → the daily series forecast already understands. */
export function dailyPointsToAggregates(
  points: DailyRatePoint[],
): DailyAggregate[] {
  return [...points]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((point) => ({
      date: point.date,
      avgBuying: point.ttBuying,
      minBuying: point.ttBuying,
      maxBuying: point.ttBuying,
      avgSelling: point.ttSelling,
      minSelling: point.ttSelling,
      maxSelling: point.ttSelling,
      samples: Math.max(point.observations, 1),
    }));
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

function dateToDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

/**
 * Calendar-day regression that still includes every point while progressively
 * reducing the influence of older market regimes.
 */
function weightedCalendarSlope(
  daily: DailyAggregate[],
  halfLifeDays: number,
): number | null {
  const points = daily
    .filter((day) => day.avgBuying !== null)
    .map((day) => ({ x: dateToDay(day.date), y: day.avgBuying! }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < MIN_DAYS_FOR_TREND) return null;

  const latestDay = Math.max(...points.map((point) => point.x));
  const weighted = points.map((point) => ({
    ...point,
    weight: 0.5 ** ((latestDay - point.x) / halfLifeDays),
  }));
  const weightSum = weighted.reduce((sum, point) => sum + point.weight, 0);
  const xMean =
    weighted.reduce((sum, point) => sum + point.weight * point.x, 0) / weightSum;
  const yMean =
    weighted.reduce((sum, point) => sum + point.weight * point.y, 0) / weightSum;
  const numerator = weighted.reduce(
    (sum, point) =>
      sum + point.weight * (point.x - xMean) * (point.y - yMean),
    0,
  );
  const denominator = weighted.reduce(
    (sum, point) => sum + point.weight * (point.x - xMean) ** 2,
    0,
  );
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * Longer-horizon TT buying assumptions. CBSL supplies the market anchor while
 * the selected bank contributes its recent quote behavior and current spread.
 */
export function buildForecastAssumptions(options: {
  bankDaily: DailyAggregate[];
  cbslDaily: DailyAggregate[];
}): ForecastAssumptions | null {
  const bankDaily = sortDailyWithBuying(options.bankDaily);
  const cbslDaily = sortDailyWithBuying(options.cbslDaily);
  const latestBank = bankDaily.at(-1);
  if (!latestBank || latestBank.avgBuying === null) return null;

  const bankSlope = weightedCalendarSlope(
    bankDaily,
    ASSUMPTION_HALF_LIFE_DAYS,
  );
  const cbslSlope = weightedCalendarSlope(
    cbslDaily,
    ASSUMPTION_HALF_LIFE_DAYS,
  );
  if (bankSlope === null || cbslSlope === null || !cbslDaily.length) return null;

  const slopePerDay =
    bankSlope * ASSUMPTION_BANK_WEIGHT + cbslSlope * ASSUMPTION_CBSL_WEIGHT;
  const currentBuying = latestBank.avgBuying;
  const definitions = [
    { horizonDays: 14 as const, label: "2 weeks" as const },
    { horizonDays: 30 as const, label: "1 month" as const },
    { horizonDays: 60 as const, label: "2 months" as const },
  ];

  return {
    slopePerDay: round(slopePerDay)!,
    bankDaysCovered: bankDaily.length,
    cbslDaysCovered: cbslDaily.length,
    cbslFirstDate: cbslDaily[0].date,
    cbslLastDate: cbslDaily.at(-1)!.date,
    halfLifeDays: ASSUMPTION_HALF_LIFE_DAYS,
    bankWeight: ASSUMPTION_BANK_WEIGHT,
    cbslWeight: ASSUMPTION_CBSL_WEIGHT,
    horizons: definitions.map(({ horizonDays, label }) => {
      const change = slopePerDay * horizonDays;
      return {
        horizonDays,
        label,
        projectedBuying: round(currentBuying + change)!,
        change: round(change)!,
        changePct: round((change / currentBuying) * 100, 2)!,
      };
    }),
  };
}

function sortDailyWithBuying(daily: DailyAggregate[]): DailyAggregate[] {
  return daily
    .filter((day) => day.avgBuying !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
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

function lastDaily(daily: DailyAggregate[]): DailyAggregate | null {
  return daily.length ? daily[daily.length - 1] : null;
}

function spread(bank: number | null, reference: number | null): number | null {
  if (bank === null || reference === null) return null;
  return round(bank - reference);
}

export function trendAlignment(
  bank: ForecastTrend | null,
  reference: ForecastTrend | null,
): TrendAlignment {
  if (!bank || !reference) return "unknown";
  if (bank.direction === "flat" || reference.direction === "flat") return "aligned";
  return bank.direction === reference.direction ? "aligned" : "diverging";
}

export function toReferenceSeriesView(options: {
  source: ReferenceSourceId;
  label: string;
  quoteKind: ReferenceQuoteKind;
  daily: DailyAggregate[];
}): ReferenceSeriesView {
  const forecast = buildForecast(options.daily);
  const latest = lastDaily(options.daily);
  return {
    source: options.source,
    label: options.label,
    quoteKind: options.quoteKind,
    latestDate: latest?.date ?? null,
    latestBuying: latest?.avgBuying ?? null,
    latestSelling: latest?.avgSelling ?? null,
    daysCovered: forecast.daysCovered,
    trend: forecast.trend,
  };
}

function comparisonNote(comparison: BankVsReference): string {
  const buy =
    comparison.buyingSpread === null
      ? null
      : `${comparison.buyingSpread > 0 ? "+" : ""}${comparison.buyingSpread.toFixed(2)}`;
  const sell =
    comparison.sellingSpread === null
      ? null
      : `${comparison.sellingSpread > 0 ? "+" : ""}${comparison.sellingSpread.toFixed(2)}`;

  if (comparison.quoteKind === "mid") {
    if (buy === null) return `${comparison.label} is not available yet.`;
    return `Bank TT buying is ${buy} vs ${comparison.label}; selling is ${sell ?? "n/a"} vs the same mid.`;
  }

  const parts = [`vs ${comparison.label}`];
  if (buy !== null) parts.push(`buying ${buy}`);
  if (sell !== null) parts.push(`selling ${sell}`);
  if (comparison.alignment === "diverging") {
    parts.push("trend is moving opposite the official series");
  } else if (comparison.alignment === "aligned" && comparison.source === "CBSL") {
    parts.push("trend matches the official series");
  }
  return parts.join(" — ");
}

export function buildCombinedReferenceSignal(options: {
  bankCode: string;
  currency: string;
  comparisons: BankVsReference[];
  errors: ForecastReferences["errors"];
}): string {
  if (!options.comparisons.length) {
    const failed = Object.values(options.errors).filter(Boolean);
    return failed.length
      ? `Could not load CBSL/Google references (${failed.join("; ")}). Bank-only forecast is unchanged.`
      : "CBSL and Google references are not available yet for this currency.";
  }

  const bits = options.comparisons.map(comparisonNote);
  return `${options.currency}/LKR at ${options.bankCode}: ${bits.join(" ")}`;
}

export function buildReferenceSignals(options: {
  bankCode: string;
  currency: string;
  bankDaily: DailyAggregate[];
  bankTrend: ForecastTrend | null;
  references: Array<{
    source: ReferenceSourceId;
    label: string;
    quoteKind: ReferenceQuoteKind;
    daily: DailyAggregate[];
  }>;
  errors?: ForecastReferences["errors"];
}): ForecastReferences {
  const bankLatest = lastDaily(options.bankDaily);
  const errors = options.errors ?? {};
  const views: Partial<Record<ReferenceSourceId, ReferenceSeriesView>> = {};
  const comparisons: BankVsReference[] = [];

  for (const ref of options.references) {
    if (!ref.daily.length) continue;
    const view = toReferenceSeriesView(ref);
    views[ref.source] = view;
    comparisons.push({
      source: ref.source,
      label: ref.label,
      quoteKind: ref.quoteKind,
      buyingSpread: spread(bankLatest?.avgBuying ?? null, view.latestBuying),
      sellingSpread: spread(bankLatest?.avgSelling ?? null, view.latestSelling),
      referenceDate: view.latestDate,
      bankDate: bankLatest?.date ?? null,
      alignment: trendAlignment(options.bankTrend, view.trend),
    });
  }

  return {
    cbsl: views.CBSL ?? null,
    google: views.GOOGLE ?? null,
    comparisons,
    combinedSignal: buildCombinedReferenceSignal({
      bankCode: options.bankCode,
      currency: options.currency,
      comparisons,
      errors,
    }),
    errors,
  };
}
