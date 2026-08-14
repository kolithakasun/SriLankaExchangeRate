import type { Handler } from "@netlify/functions";
import { getAvailableHistoryDates, getHistory, usingSupabase } from "./lib/store.js";
import { json, wrap } from "./lib/http.js";
import { getEnabledBanks } from "../../shared/config/banks.js";
import { supportedCurrencyCodes } from "../../shared/config/currencies.js";
import { colomboDateKey } from "../../shared/utils/time.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters ?? {};
  const bank = (params.bank ?? "SEYLAN").toUpperCase();
  const currency = (params.currency ?? "USD").toUpperCase();
  const date = params.date ?? colomboDateKey();

  if (!getEnabledBanks().some((b) => b.code === bank)) {
    return json(400, { error: "Unknown bank" });
  }
  if (!supportedCurrencyCodes.includes(currency)) {
    return json(400, { error: "Unsupported currency" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(400, { error: "Invalid date (expected YYYY-MM-DD)" });
  }

  const [points, dates] = await Promise.all([
    getHistory({ bank, currency, date }),
    getAvailableHistoryDates({ bank, currency }),
  ]);

  return json(200, {
    bank,
    currency,
    date,
    storage: usingSupabase() ? "supabase" : "local",
    points,
    availableDates: dates,
  });
});

export { handler };
