import { describe, expect, it } from "vitest";
import {
  hashForecastInput,
  nextColomboMidnightIso,
  CURSOR_DAILY_LIMIT,
} from "../netlify/functions/lib/cursor-quota";
import type { ForecastResult } from "../shared/types";

function sampleForecast(overrides: Partial<ForecastResult> = {}): ForecastResult {
  return {
    daysCovered: 3,
    confidence: "medium",
    trend: {
      direction: "down",
      pctChangePerDay: -0.1,
      projectedNextDayBuying: 323,
      projectedNextDaySelling: 330,
    },
    bestDayOfWeek: null,
    worstDayOfWeek: null,
    suggestedAction: "Rates falling",
    daily: [
      {
        date: "2026-08-29",
        avgBuying: 324,
        minBuying: 324,
        maxBuying: 324,
        avgSelling: 331,
        minSelling: 331,
        maxSelling: 331,
        samples: 1,
      },
    ],
    ...overrides,
  };
}

describe("cursor quota helpers", () => {
  it("hashes forecast inputs stably", () => {
    const a = hashForecastInput({
      bank: "SEYLAN",
      currency: "USD",
      range: "1m",
      forecast: sampleForecast(),
    });
    const b = hashForecastInput({
      bank: "SEYLAN",
      currency: "USD",
      range: "1m",
      forecast: sampleForecast(),
    });
    const c = hashForecastInput({
      bank: "SEYLAN",
      currency: "USD",
      range: "1m",
      forecast: sampleForecast({
        trend: {
          direction: "up",
          pctChangePerDay: 0.1,
          projectedNextDayBuying: 325,
          projectedNextDaySelling: 332,
        },
      }),
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it("computes next Colombo midnight in UTC", () => {
    // 2026-08-31 18:00 UTC is still 2026-08-31 evening in Colombo (UTC+5:30).
    const reset = nextColomboMidnightIso("2026-08-31T18:00:00.000Z");
    expect(reset).toBe("2026-08-31T18:30:00.000Z");
  });

  it("exposes a global daily limit of two", () => {
    expect(CURSOR_DAILY_LIMIT).toBe(2);
  });
});
