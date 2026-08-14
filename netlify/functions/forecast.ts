import type { Handler } from "@netlify/functions";
import { getAvailableHistoryDates, getHistory } from "./lib/store.js";
import { json, wrap } from "./lib/http.js";
import { getEnabledBanks } from "../../shared/config/banks.js";
import { DEFAULT_CURRENCY, supportedCurrencyCodes } from "../../shared/config/currencies.js";
import type { ForecastAdvice, ForecastDailyPoint, ForecastPoint, ForecastResponse } from "../../shared/types.js";

type Confidence = ForecastAdvice["confidence"];

function toFixedNumber(value: number): number {
  return Number(value.toFixed(4));
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.floor(n);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

function nextDate(date: string, addDays: number): string {
  const d = new Date(`${date}T12:00:00+05:30`);
  d.setDate(d.getDate() + addDays);
  return d.toISOString().slice(0, 10);
}

function linearForecast(points: Array<{ x: number; y: number }>, horizon: number): number[] {
  if (points.length < 2) return [];

  const n = points.length;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);

  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const lastX = points[points.length - 1]!.x;
  return Array.from({ length: horizon }, (_, i) => {
    const pred = intercept + slope * (lastX + i + 1);
    return toFixedNumber(Math.max(0, pred));
  });
}

function confidenceForData(historyDays: number): Confidence {
  if (historyDays >= 7) return "high";
  if (historyDays >= 3) return "medium";
  return "low";
}

function chooseBestDate<T extends { date: string }>(
  rows: T[],
  accessor: (row: T) => number | null,
  mode: "min" | "max",
): string | null {
  let picked: { date: string; value: number } | null = null;

  for (const row of rows) {
    const value = accessor(row);
    if (value === null) continue;
    if (!picked) {
      picked = { date: row.date, value };
      continue;
    }
    if (mode === "min" && value < picked.value) {
      picked = { date: row.date, value };
    }
    if (mode === "max" && value > picked.value) {
      picked = { date: row.date, value };
    }
  }

  return picked?.date ?? null;
}

function buildAdvice(
  historySeries: ForecastDailyPoint[],
  forecast: ForecastPoint[],
): ForecastAdvice[] {
  const historyDays = historySeries.length;
  const confidence = confidenceForData(historyDays);

  if (historyDays < 2) {
    return [
      {
        action: "buy_forex",
        recommendedDate: null,
        confidence,
        reason:
          "Need at least 2 daily points before suggesting a best day. Keep collecting data for a few days.",
      },
      {
        action: "sell_forex",
        recommendedDate: null,
        confidence,
        reason:
          "Need at least 2 daily points before suggesting a best day. Keep collecting data for a few days.",
      },
    ];
  }

  const bestBuyFromForecast = chooseBestDate(forecast, (p) => p.predictedSelling, "min");
  const bestSellFromForecast = chooseBestDate(forecast, (p) => p.predictedBuying, "max");

  const bestBuyFromHistory = chooseBestDate(historySeries, (p) => p.closeSelling, "min");
  const bestSellFromHistory = chooseBestDate(historySeries, (p) => p.closeBuying, "max");

  return [
    {
      action: "buy_forex",
      recommendedDate: bestBuyFromForecast ?? bestBuyFromHistory,
      confidence,
      reason: bestBuyFromForecast
        ? "Projected TT selling is lowest on this upcoming day in the current trend."
        : "Using historical closes only because there is not enough data for a forward forecast.",
    },
    {
      action: "sell_forex",
      recommendedDate: bestSellFromForecast ?? bestSellFromHistory,
      confidence,
      reason: bestSellFromForecast
        ? "Projected TT buying is highest on this upcoming day in the current trend."
        : "Using historical closes only because there is not enough data for a forward forecast.",
    },
  ];
}

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters ?? {};
  const bank = (params.bank ?? getEnabledBanks()[0]?.code ?? "SEYLAN").toUpperCase();
  const currency = (params.currency ?? DEFAULT_CURRENCY).toUpperCase();
  const lookbackDays = parsePositiveInt(params.window, 7, 1, 30);
  const horizonDays = parsePositiveInt(params.horizon, 3, 1, 14);

  if (!getEnabledBanks().some((b) => b.code === bank)) {
    return json(400, { error: "Unknown bank" });
  }
  if (!supportedCurrencyCodes.includes(currency)) {
    return json(400, { error: "Unsupported currency" });
  }

  const availableDates = await getAvailableHistoryDates({ bank, currency });
  const selectedDates = [...availableDates]
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, lookbackDays)
    .sort((a, b) => (a > b ? 1 : -1));

  const byDate = await Promise.all(
    selectedDates.map(async (date) => {
      const points = await getHistory({ bank, currency, date });
      const closes = points[points.length - 1] ?? null;
      const selling = points.map((p) => p.ttSelling).filter((n): n is number => n !== null);
      const buying = points.map((p) => p.ttBuying).filter((n): n is number => n !== null);

      return {
        date,
        closeBuying: closes?.ttBuying ?? null,
        closeSelling: closes?.ttSelling ?? null,
        minSelling: selling.length ? Math.min(...selling) : null,
        maxBuying: buying.length ? Math.max(...buying) : null,
        samples: points.length,
      } satisfies ForecastDailyPoint;
    }),
  );

  const series = byDate.filter((d) => d.samples > 0);
  const xIndex = new Map(series.map((row, i) => [row.date, i] as const));

  const buyingPoints = series
    .filter((s) => s.closeBuying !== null)
    .map((s) => ({ x: xIndex.get(s.date) ?? 0, y: s.closeBuying as number }));

  const sellingPoints = series
    .filter((s) => s.closeSelling !== null)
    .map((s) => ({ x: xIndex.get(s.date) ?? 0, y: s.closeSelling as number }));

  const predictedBuying = linearForecast(buyingPoints, horizonDays);
  const predictedSelling = linearForecast(sellingPoints, horizonDays);

  const lastDate = series[series.length - 1]?.date ?? null;
  const forecast: ForecastPoint[] = Array.from({ length: horizonDays }, (_, i) => ({
    date: lastDate ? nextDate(lastDate, i + 1) : `+${i + 1}`,
    predictedBuying: predictedBuying[i] ?? null,
    predictedSelling: predictedSelling[i] ?? null,
  }));

  const dataQuality: ForecastResponse["dataQuality"] =
    series.length < 2 ? "insufficient" : series.length < 7 ? "limited" : "good";

  return json(200, {
    bank,
    currency,
    lookbackDays,
    horizonDays,
    historyDaysAvailable: availableDates.length,
    method: "trend_regression",
    dataQuality,
    series,
    forecast,
    advice: buildAdvice(series, forecast),
  } satisfies ForecastResponse);
});

export { handler };
