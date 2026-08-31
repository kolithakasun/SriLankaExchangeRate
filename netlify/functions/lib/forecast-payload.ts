import { getDailyHistory, usingSupabase } from "./store.js";
import { getAvailableProviders, narrateForecast } from "./ai.js";
import { isForecastableBank } from "../../../shared/config/banks.js";
import {
  DEFAULT_CURRENCY,
  supportedCurrencyCodes,
} from "../../../shared/config/currencies.js";
import {
  getForecastRange,
  MAX_RANGE_DAYS,
  resolveForecastWindow,
} from "../../../shared/config/ranges.js";
import {
  buildForecast,
  buildForecastAssumptions,
  dailyPointsToAggregates,
} from "../../../shared/utils/forecast.js";
import { nowIso } from "../../../shared/utils/time.js";
import {
  loadCbslDaily,
  loadForecastReferences,
  withReferences,
} from "./forecast-references.js";
import type { ForecastRange } from "../../../shared/types.js";

export interface ForecastRequest {
  bank: string;
  currency: string;
  range: ForecastRange;
  days: number;
  includeReferences: boolean;
  provider?: string;
}

/** Shared query parsing so GET /api/forecast and the manual refresh agree. */
export function resolveForecastRequest(
  params: Record<string, string | undefined>,
): { request: ForecastRequest } | { error: string } {
  const bank = (params.bank ?? "SEYLAN").toUpperCase();
  const currency = (params.currency ?? DEFAULT_CURRENCY).toUpperCase();

  if (!isForecastableBank(bank)) return { error: "Unknown bank" };
  if (!supportedCurrencyCodes.includes(currency)) {
    return { error: "Unsupported currency" };
  }

  const { range, days } = resolveForecastWindow({
    range: params.range,
    days: params.days,
  });

  return {
    request: {
      bank,
      currency,
      range,
      days,
      includeReferences:
        params.references !== "0" && params.references !== "false",
      provider: params.provider,
    },
  };
}

/**
 * Builds the forecast response. `forceLiveCbsl` is used by the manual refresh
 * so the official series is re-pulled instead of trusting stored coverage.
 */
export async function buildForecastPayload(
  request: ForecastRequest,
  options: { forceLiveCbsl?: boolean } = {},
) {
  const { bank, currency, range, days, includeReferences } = request;

  const [{ daily: snapshots }, { daily: allBankSnapshots }, cbslAll] =
    await Promise.all([
      getDailyHistory({ bank, currency, days }),
      getDailyHistory({ bank, currency, days: MAX_RANGE_DAYS }),
      loadCbslDaily(currency, MAX_RANGE_DAYS, {
        forceLive: options.forceLiveCbsl,
      }),
    ]);

  const daily = dailyPointsToAggregates(snapshots);
  let forecast = buildForecast(daily);

  const assumptions = buildForecastAssumptions({
    bankDaily: dailyPointsToAggregates(allBankSnapshots),
    cbslDaily: cbslAll.daily,
  });
  if (assumptions) {
    forecast = { ...forecast, assumptions };
  }

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
    { requestedProvider: request.provider },
  );

  return {
    bank,
    currency,
    storage: usingSupabase() ? "supabase" : "local",
    range,
    days,
    daysAnalyzed: forecast.daysCovered,
    confidence: forecast.confidence,
    includeReferences,
    generatedAt: nowIso(),
    forecast,
    narration: narration.text,
    narrationSource: narration.source,
    availableProviders: getAvailableProviders(),
  };
}
