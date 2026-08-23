import { getDailyHistory } from "./store.js";
import { fetchCbslHistory } from "../providers/cbsl.js";
import { fetchGoogleMid } from "../providers/google.js";
import {
  buildReferenceSignals,
  cbslStoredCoverageIsEnough,
  dailyPointsToAggregates,
  groupByColomboDay,
} from "../../../shared/utils/forecast.js";
import { colomboDateKey } from "../../../shared/utils/time.js";
import type {
  DailyAggregate,
  ForecastReferences,
  ForecastResult,
  ForecastTrend,
  ReferenceSourceId,
} from "../../../shared/types.js";

const CBSL_LIVE_TIMEOUT_MS = 18_000;

function sortDaily(daily: DailyAggregate[]): DailyAggregate[] {
  return [...daily].sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function loadStoredDaily(
  bank: string,
  currency: string,
  days: number,
): Promise<DailyAggregate[]> {
  const { daily } = await getDailyHistory({ bank, currency, days });
  return dailyPointsToAggregates(daily);
}

async function fetchCbslHistoryBounded(options: {
  days: number;
  currencies: string[];
}) {
  return Promise.race([
    fetchCbslHistory(options),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("CBSL official history timed out")),
        CBSL_LIVE_TIMEOUT_MS,
      );
    }),
  ]);
}

async function loadCbslDaily(
  currency: string,
  days: number,
): Promise<{ daily: DailyAggregate[]; error?: string }> {
  let stored: DailyAggregate[] = [];
  try {
    stored = await loadStoredDaily("CBSL", currency, days);
  } catch (err) {
    stored = [];
    const message = err instanceof Error ? err.message : String(err);
    try {
      const live = await fetchCbslHistoryBounded({ days, currencies: [currency] });
      const liveDaily = groupByColomboDay(
        live.filter((point) => point.currency === currency),
      );
      if (liveDaily.length) return { daily: liveDaily };
    } catch {
      // Fall through to the stored-empty error below.
    }
    return { daily: [], error: message };
  }

  if (cbslStoredCoverageIsEnough(stored.length, days)) {
    return { daily: stored };
  }

  try {
    const live = await fetchCbslHistoryBounded({ days, currencies: [currency] });
    const liveDaily = groupByColomboDay(
      live.filter((point) => point.currency === currency),
    );
    if (liveDaily.length) return { daily: liveDaily };
    if (stored.length) return { daily: stored };
    return { daily: [], error: "CBSL has not published TT rates for this range" };
  } catch (err) {
    if (stored.length) return { daily: stored };
    return {
      daily: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function loadGoogleDaily(
  currency: string,
  days: number,
): Promise<{ daily: DailyAggregate[]; error?: string }> {
  let stored: DailyAggregate[] = [];
  try {
    stored = await loadStoredDaily("GOOGLE", currency, days);
  } catch (err) {
    stored = [];
    const message = err instanceof Error ? err.message : String(err);
    try {
      const mid = await fetchGoogleMid(currency);
      if (mid === null) return { daily: [], error: message };
    } catch {
      return { daily: [], error: message };
    }
  }

  try {
    const mid = await fetchGoogleMid(currency);
    if (mid === null) {
      return stored.length
        ? { daily: stored }
        : { daily: [], error: `No Google Finance mid for ${currency}/LKR` };
    }
    const today = colomboDateKey();
    const merged = stored.filter((day) => day.date !== today);
    merged.push({
      date: today,
      avgBuying: mid,
      minBuying: mid,
      maxBuying: mid,
      avgSelling: mid,
      minSelling: mid,
      maxSelling: mid,
      samples: 2,
    });
    return { daily: sortDaily(merged) };
  } catch (err) {
    if (stored.length) return { daily: stored };
    return {
      daily: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function loadForecastReferences(options: {
  bankCode: string;
  currency: string;
  days: number;
  bankDaily: DailyAggregate[];
  bankTrend: ForecastTrend | null;
}): Promise<ForecastReferences> {
  const [cbsl, google] = await Promise.all([
    loadCbslDaily(options.currency, options.days),
    loadGoogleDaily(options.currency, options.days),
  ]);

  const errors: ForecastReferences["errors"] = {};
  if (cbsl.error) errors.CBSL = cbsl.error;
  if (google.error) errors.GOOGLE = google.error;

  const references: Array<{
    source: ReferenceSourceId;
    label: string;
    quoteKind: "tt" | "mid";
    daily: DailyAggregate[];
  }> = [];

  if (cbsl.daily.length) {
    references.push({
      source: "CBSL",
      label: "CBSL official TT",
      quoteKind: "tt",
      daily: cbsl.daily,
    });
  }
  if (google.daily.length) {
    references.push({
      source: "GOOGLE",
      label: "Google mid",
      quoteKind: "mid",
      daily: google.daily,
    });
  }

  return buildReferenceSignals({
    bankCode: options.bankCode,
    currency: options.currency,
    bankDaily: options.bankDaily,
    bankTrend: options.bankTrend,
    references,
    errors,
  });
}

/** Attach references without changing the bank-only forecast numbers. */
export function withReferences(
  forecast: ForecastResult,
  references: ForecastReferences,
): ForecastResult {
  return { ...forecast, references };
}
