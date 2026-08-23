import type { Handler } from "@netlify/functions";
import {
  getAvailableHistoryDates,
  getDailyHistory,
  getHistory,
  usingSupabase,
} from "./lib/store.js";
import { json, wrap } from "./lib/http.js";
import { isEnabledSource } from "../../shared/config/banks.js";
import { fetchCbslHistory } from "./providers/cbsl.js";
import { fetchGoogleMid } from "./providers/google.js";
import { summarizeDailySeries, toDailySeries } from "../../shared/utils/history.js";
import type { DailyRatePoint, HistoryPoint } from "../../shared/types.js";
import { colomboDateKey, nowIso } from "../../shared/utils/time.js";
import {
  DEFAULT_CURRENCY,
  supportedCurrencyCodes,
} from "../../shared/config/currencies.js";
import {
  getRangeDays,
  historyRanges,
  isHistoryRange,
} from "../../shared/config/ranges.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters ?? {};
  const bank = (params.bank ?? "SEYLAN").toUpperCase();
  const currency = (params.currency ?? DEFAULT_CURRENCY).toUpperCase();
  const date = params.date ?? colomboDateKey();
  const range = (params.range ?? "1d").toLowerCase();

  if (!isEnabledSource(bank)) {
    return json(400, { error: "Unknown bank" });
  }
  if (!supportedCurrencyCodes.includes(currency)) {
    return json(400, { error: "Unsupported currency" });
  }
  if (!isHistoryRange(range)) {
    return json(400, {
      error: `Invalid range. Supported: ${historyRanges.map((r) => r.value).join(", ")}`,
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(400, { error: "Invalid date (expected YYYY-MM-DD)" });
  }

  const storage = usingSupabase() ? "supabase" : "local";

  if (range === "1d") {
    const [storedPoints, dates] = await Promise.all([
      getHistory({ bank, currency, date }),
      getAvailableHistoryDates({ bank, currency }),
    ]);
    const points = await withLiveHistoryPoints(bank, currency, date, storedPoints);

    return json(200, {
      bank,
      currency,
      mode: "day",
      range,
      date,
      days: 1,
      storage,
      dailySource: null,
      points,
      daily: [],
      summary: null,
      availableDates: dates,
    });
  }

  const days = getRangeDays(range);
  const [{ daily: storedDaily, source: storedSource }, dates] = await Promise.all([
    getDailyHistory({ bank, currency, days }),
    getAvailableHistoryDates({ bank, currency }),
  ]);
  const { daily, source } = await withLiveDailyHistory(
    bank,
    currency,
    days,
    storedDaily,
    storedSource,
  );

  return json(200, {
    bank,
    currency,
    mode: "range",
    range,
    date,
    days,
    storage,
    dailySource: source,
    points: [],
    daily,
    summary: summarizeDailySeries(daily),
    availableDates: dates,
  });
});

async function withLiveHistoryPoints(
  bank: string,
  currency: string,
  date: string,
  stored: HistoryPoint[],
): Promise<HistoryPoint[]> {
  if (stored.length) return stored;
  if (bank === "CBSL") {
    try {
      const live = await fetchCbslHistory({ days: 7, currencies: [currency] });
      return live.filter(
        (point) => point.currency === currency && colomboDateKey(point.retrievedAt) === date,
      );
    } catch {
      return stored;
    }
  }
  if (bank === "GOOGLE" && date === colomboDateKey()) {
    try {
      const mid = await fetchGoogleMid(currency);
      if (mid === null) return stored;
      const retrievedAt = nowIso();
      return [
        {
          bankCode: "GOOGLE",
          currency,
          ttBuying: mid,
          ttSelling: mid,
          sourceTimestamp: retrievedAt,
          retrievedAt,
        },
      ];
    } catch {
      return stored;
    }
  }
  return stored;
}

async function withLiveDailyHistory(
  bank: string,
  currency: string,
  days: number,
  stored: DailyRatePoint[],
  source: "snapshot" | "observations",
): Promise<{ daily: DailyRatePoint[]; source: "snapshot" | "observations" }> {
  if (bank === "CBSL" && stored.length < 3) {
    try {
      const live = await fetchCbslHistory({ days, currencies: [currency] });
      const liveDaily = toDailySeries(live.filter((point) => point.currency === currency));
      if (liveDaily.length > stored.length) {
        return { daily: liveDaily, source: "observations" };
      }
    } catch {
      return { daily: stored, source };
    }
  }

  if (bank === "GOOGLE") {
    try {
      const mid = await fetchGoogleMid(currency);
      if (mid === null) return { daily: stored, source };
      const today = colomboDateKey();
      const merged = stored.filter((day) => day.date !== today);
      const now = nowIso();
      merged.push({
        date: today,
        ttBuying: mid,
        ttSelling: mid,
        openTtBuying: mid,
        openTtSelling: mid,
        sourceTimestamp: now,
        firstSeenAt: now,
        lastCheckedAt: now,
        lastChangedAt: now,
        changeCount: 0,
        observations: 1,
      });
      merged.sort((a, b) => (a.date < b.date ? -1 : 1));
      return { daily: merged, source: stored.length ? source : "observations" };
    } catch {
      return { daily: stored, source };
    }
  }

  return { daily: stored, source };
}

export { handler };
