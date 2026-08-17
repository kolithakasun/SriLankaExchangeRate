import type { Handler } from "@netlify/functions";
import {
  getAvailableHistoryDates,
  getDailyHistory,
  getHistory,
  usingSupabase,
} from "./lib/store.js";
import { json, wrap } from "./lib/http.js";
import { getEnabledBanks } from "../../shared/config/banks.js";
import {
  DEFAULT_CURRENCY,
  supportedCurrencyCodes,
} from "../../shared/config/currencies.js";
import {
  getRangeDays,
  historyRanges,
  isHistoryRange,
} from "../../shared/config/ranges.js";
import { summarizeDailySeries } from "../../shared/utils/history.js";
import { colomboDateKey } from "../../shared/utils/time.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters ?? {};
  const bank = (params.bank ?? "SEYLAN").toUpperCase();
  const currency = (params.currency ?? DEFAULT_CURRENCY).toUpperCase();
  const date = params.date ?? colomboDateKey();
  const range = (params.range ?? "1d").toLowerCase();

  if (!getEnabledBanks().some((b) => b.code === bank)) {
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
    const [points, dates] = await Promise.all([
      getHistory({ bank, currency, date }),
      getAvailableHistoryDates({ bank, currency }),
    ]);

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
  const [{ daily, source }, dates] = await Promise.all([
    getDailyHistory({ bank, currency, days }),
    getAvailableHistoryDates({ bank, currency }),
  ]);

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

export { handler };
