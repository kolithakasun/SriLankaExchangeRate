import type { Handler } from "@netlify/functions";
import { getHistoryRange, usingSupabase } from "./lib/store.js";
import { json, wrap } from "./lib/http.js";
import { getAvailableProviders, narrateForecast } from "./lib/ai.js";
import { getEnabledBanks } from "../../shared/config/banks.js";
import {
  DEFAULT_CURRENCY,
  supportedCurrencyCodes,
} from "../../shared/config/currencies.js";
import { buildForecast, groupByColomboDay } from "../../shared/utils/forecast.js";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters ?? {};
  const bank = (params.bank ?? "SEYLAN").toUpperCase();
  const currency = (params.currency ?? DEFAULT_CURRENCY).toUpperCase();
  const days = Math.min(Math.max(Number(params.days) || DEFAULT_DAYS, 1), MAX_DAYS);

  if (!getEnabledBanks().some((b) => b.code === bank)) {
    return json(400, { error: "Unknown bank" });
  }
  if (!supportedCurrencyCodes.includes(currency)) {
    return json(400, { error: "Unsupported currency" });
  }

  const points = await getHistoryRange({ bank, currency, days });
  const daily = groupByColomboDay(points);
  const forecast = buildForecast(daily);
  const narration = await narrateForecast(
    forecast,
    { bank, currency },
    { requestedProvider: params.provider },
  );

  return json(200, {
    bank,
    currency,
    storage: usingSupabase() ? "supabase" : "local",
    daysAnalyzed: forecast.daysCovered,
    confidence: forecast.confidence,
    forecast,
    narration: narration.text,
    narrationSource: narration.source,
    availableProviders: getAvailableProviders(),
  });
});

export { handler };
