import { getDailyHistory, usingSupabase } from "./store.js";
import {
  getAvailableProviders,
  narrateForecast,
  templateForecastNarration,
} from "./ai.js";
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
import type { ForecastRange, ForecastResult } from "../../../shared/types.js";

export interface ForecastRequest {
  bank: string;
  currency: string;
  range: ForecastRange;
  days: number;
  includeReferences: boolean;
  provider?: string;
}

export interface ForecastNumericPayload {
  bank: string;
  currency: string;
  storage: string;
  range: ForecastRange;
  days: number;
  daysAnalyzed: number;
  confidence: ForecastResult["confidence"];
  includeReferences: boolean;
  generatedAt: string;
  forecast: ForecastResult;
  rangeLabel: string;
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
 * Numeric forecast only — no AI narration. Used by Cursor async flow so we can
 * hash inputs and attach narration later.
 */
export async function buildForecastNumericPayload(
  request: ForecastRequest,
  options: { forceLiveCbsl?: boolean } = {},
): Promise<ForecastNumericPayload> {
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
  const rangeLabel = rangeConfig
    ? `${rangeConfig.label} (${rangeConfig.description.toLowerCase()})`
    : range;

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
    rangeLabel,
  };
}

/**
 * Builds the forecast response. `forceLiveCbsl` is used by the manual refresh
 * so the official series is re-pulled instead of trusting stored coverage.
 * Cursor is never invoked here — use the dedicated authenticated async path.
 */
export async function buildForecastPayload(
  request: ForecastRequest,
  options: {
    forceLiveCbsl?: boolean;
    includeCursorProvider?: boolean;
    narrationOverride?: {
      text: string;
      source: "cursor" | "gemini" | "groq" | "template";
      cached?: boolean;
    };
  } = {},
) {
  const numeric = await buildForecastNumericPayload(request, options);
  const providerRequested = request.provider?.toLowerCase();

  let narrationText: string;
  let narrationSource: "gemini" | "groq" | "cursor" | "template";
  let narrationCached = false;

  if (options.narrationOverride) {
    narrationText = options.narrationOverride.text;
    narrationSource = options.narrationOverride.source;
    narrationCached = Boolean(options.narrationOverride.cached);
  } else if (providerRequested === "cursor") {
    // Anonymous/sync path must not spend Cursor credits.
    narrationText = templateForecastNarration(numeric.forecast, {
      bank: numeric.bank,
      currency: numeric.currency,
      rangeLabel: numeric.rangeLabel,
    });
    narrationSource = "template";
  } else {
    const narration = await narrateForecast(
      numeric.forecast,
      {
        bank: numeric.bank,
        currency: numeric.currency,
        rangeLabel: numeric.rangeLabel,
      },
      { requestedProvider: request.provider },
    );
    narrationText = narration.text;
    narrationSource = narration.source;
  }

  const { rangeLabel: _rangeLabel, ...rest } = numeric;

  return {
    ...rest,
    narration: narrationText,
    narrationSource,
    narrationCached,
    availableProviders: getAvailableProviders({
      includeCursor: options.includeCursorProvider,
    }),
  };
}
