import type { Handler } from "@netlify/functions";
import { getDailyHistory, usingSupabase } from "./lib/store.js";
import { json, wrap } from "./lib/http.js";
import { getAvailableProviders, narrateForecast } from "./lib/ai.js";
import { isForecastableBank } from "../../shared/config/banks.js";
import {
  DEFAULT_CURRENCY,
  supportedCurrencyCodes,
} from "../../shared/config/currencies.js";
import {
  getForecastRange,
  resolveForecastWindow,
} from "../../shared/config/ranges.js";
import {
  buildForecast,
  dailyPointsToAggregates,
} from "../../shared/utils/forecast.js";
import {
  loadForecastReferences,
  withReferences,
} from "./lib/forecast-references.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters ?? {};
  const bank = (params.bank ?? "SEYLAN").toUpperCase();
  const currency = (params.currency ?? DEFAULT_CURRENCY).toUpperCase();
  const { range, days } = resolveForecastWindow({
    range: params.range,
    days: params.days,
  });

  if (!isForecastableBank(bank)) {
    return json(400, { error: "Unknown bank" });
  }
  if (!supportedCurrencyCodes.includes(currency)) {
    return json(400, { error: "Unsupported currency" });
  }

  const includeReferences = params.references !== "0" && params.references !== "false";

  const { daily: snapshots } = await getDailyHistory({ bank, currency, days });
  const daily = dailyPointsToAggregates(snapshots);
  let forecast = buildForecast(daily);

  if (includeReferences) {
    const references = await loadForecastReferences({
      bankCode: bank,
      currency,
      days,
      bankDaily: daily,
      bankTrend: forecast.trend,
    });
    forecast = withReferences(forecast, references);
  }

  const rangeConfig = getForecastRange(range);
  const narration = await narrateForecast(
    forecast,
    {
      bank,
      currency,
      rangeLabel: rangeConfig
        ? `${rangeConfig.label} (${rangeConfig.description.toLowerCase()})`
        : range,
    },
    { requestedProvider: params.provider },
  );

  return json(200, {
    bank,
    currency,
    storage: usingSupabase() ? "supabase" : "local",
    range,
    days,
    daysAnalyzed: forecast.daysCovered,
    confidence: forecast.confidence,
    includeReferences,
    forecast,
    narration: narration.text,
    narrationSource: narration.source,
    availableProviders: getAvailableProviders(),
  });
});

export { handler };
