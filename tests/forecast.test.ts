import { describe, expect, it } from "vitest";
import {
  buildForecast,
  buildForecastAssumptions,
  buildReferenceSignals,
  cbslStoredCoverageIsEnough,
  dailyPointsToAggregates,
  dayOfWeekAverages,
  groupByColomboDay,
  linearTrend,
  trendAlignment,
  weekdayName,
} from "../shared/utils/forecast";
import {
  DEFAULT_FORECAST_RANGE,
  MAX_RANGE_DAYS,
  getForecastRangeDays,
  resolveForecastWindow,
} from "../shared/config/ranges";
import type { DailyAggregate, DailyRatePoint, HistoryPoint } from "../shared/types";
import {
  getEnabledBanks,
  getEnabledSources,
  isReferenceSource,
} from "../shared/config/banks";

function point(
  dateKey: string,
  hour: string,
  ttBuying: number | null,
  ttSelling: number | null,
): HistoryPoint {
  return {
    bankCode: "SEYLAN",
    currency: "AUD",
    ttBuying,
    ttSelling,
    sourceTimestamp: null,
    retrievedAt: `${dateKey}T${hour}:00:00+05:30`,
  };
}

describe("forecast windows", () => {
  it("defaults to 1 month", () => {
    expect(DEFAULT_FORECAST_RANGE).toBe("1m");
    expect(resolveForecastWindow({})).toEqual({ range: "1m", days: 30 });
  });

  it("prefers an explicit range over days", () => {
    expect(resolveForecastWindow({ range: "6m", days: "7" })).toEqual({
      range: "6m",
      days: 180,
    });
    expect(getForecastRangeDays("2w")).toBe(14);
    expect(resolveForecastWindow({ range: "1y" })).toEqual({
      range: "1y",
      days: 365,
    });
    expect(resolveForecastWindow({ range: "all" })).toEqual({
      range: "all",
      days: MAX_RANGE_DAYS,
    });
  });

  it("snaps a raw days value to the nearest window", () => {
    expect(resolveForecastWindow({ days: "45" }).range).toBe("1m");
    expect(resolveForecastWindow({ days: "200" })).toEqual({
      range: "6m",
      days: 180,
    });
    expect(resolveForecastWindow({ days: "400" }).range).toBe("1y");
  });
});

describe("dailyPointsToAggregates", () => {
  it("maps snapshot rows into the forecast daily series", () => {
    const points: DailyRatePoint[] = [
      {
        date: "2026-08-21",
        ttBuying: 322,
        ttSelling: 334,
        openTtBuying: 321,
        openTtSelling: 333,
        sourceTimestamp: null,
        firstSeenAt: null,
        lastCheckedAt: null,
        lastChangedAt: null,
        changeCount: 1,
        observations: 3,
      },
      {
        date: "2026-08-20",
        ttBuying: 321,
        ttSelling: 333,
        openTtBuying: 321,
        openTtSelling: 333,
        sourceTimestamp: null,
        firstSeenAt: null,
        lastCheckedAt: null,
        lastChangedAt: null,
        changeCount: 0,
        observations: 1,
      },
    ];
    const daily = dailyPointsToAggregates(points);
    expect(daily.map((d) => d.date)).toEqual(["2026-08-20", "2026-08-21"]);
    expect(daily[1].avgBuying).toBe(322);
    expect(daily[1].samples).toBe(3);
  });
});

describe("CBSL stored coverage", () => {
  it("uses the database once a short window has 3 days", () => {
    expect(cbslStoredCoverageIsEnough(3, 7)).toBe(true);
    expect(cbslStoredCoverageIsEnough(2, 7)).toBe(false);
  });

  it("live-fills long windows when the DB is still thin", () => {
    expect(cbslStoredCoverageIsEnough(5, 180)).toBe(false);
    expect(cbslStoredCoverageIsEnough(40, 180)).toBe(true);
  });
});

describe("groupByColomboDay", () => {
  it("buckets intraday points into daily averages", () => {
    const points = [
      point("2026-08-10", "09", 100, 110),
      point("2026-08-10", "15", 102, 112),
      point("2026-08-11", "09", 104, 114),
    ];
    const daily = groupByColomboDay(points);
    expect(daily).toHaveLength(2);
    expect(daily[0].date).toBe("2026-08-10");
    expect(daily[0].avgBuying).toBeCloseTo(101, 5);
    expect(daily[0].samples).toBe(4);
    expect(daily[1].date).toBe("2026-08-11");
    expect(daily[1].avgBuying).toBeCloseTo(104, 5);
  });

  it("ignores null rates when averaging", () => {
    const points = [point("2026-08-10", "09", null, 110), point("2026-08-10", "15", 102, null)];
    const daily = groupByColomboDay(points);
    expect(daily[0].avgBuying).toBe(102);
    expect(daily[0].avgSelling).toBe(110);
  });
});

describe("linearTrend", () => {
  it("detects a rising series", () => {
    const { slopePerDay } = linearTrend([100, 101, 102, 103]);
    expect(slopePerDay).toBeCloseTo(1, 5);
  });

  it("detects a falling series", () => {
    const { slopePerDay } = linearTrend([103, 102, 101, 100]);
    expect(slopePerDay).toBeCloseTo(-1, 5);
  });

  it("returns zero slope for a flat series", () => {
    const { slopePerDay } = linearTrend([100, 100, 100]);
    expect(slopePerDay).toBeCloseTo(0, 5);
  });
});

describe("dayOfWeekAverages", () => {
  it("groups daily aggregates by weekday", () => {
    const daily = groupByColomboDay([
      point("2026-08-10", "09", 100, 110), // Monday
      point("2026-08-17", "09", 104, 114), // Monday
      point("2026-08-11", "09", 90, 95), // Tuesday
    ]);
    const stats = dayOfWeekAverages(daily);
    const monday = stats.find((s) => s.weekday === 1)!;
    expect(monday.samples).toBe(2);
    expect(monday.avgBuying).toBeCloseTo(102, 5);
    expect(weekdayName(1)).toBe("Monday");
  });
});

describe("buildForecast", () => {
  it("reports low confidence and no trend with under 3 days", () => {
    const daily = groupByColomboDay([point("2026-08-10", "09", 100, 110)]);
    const forecast = buildForecast(daily);
    expect(forecast.confidence).toBe("low");
    expect(forecast.trend).toBeNull();
    expect(forecast.bestDayOfWeek).toBeNull();
    expect(forecast.suggestedAction).toMatch(/Only 1 day/);
  });

  it("reports medium confidence with a trend at 3-13 days, no day-of-week", () => {
    const points = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"].map((d, i) =>
      point(d, "09", 100 + i, 110 + i),
    );
    const forecast = buildForecast(groupByColomboDay(points));
    expect(forecast.confidence).toBe("medium");
    expect(forecast.trend).not.toBeNull();
    expect(forecast.trend!.direction).toBe("up");
    expect(forecast.bestDayOfWeek).toBeNull();
  });

  it("reports high confidence with day-of-week stats at 14+ days", () => {
    const dates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date("2026-08-01T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const points = dates.map((d, i) => point(d, "09", 100 + (i % 3), 110 + (i % 3)));
    const forecast = buildForecast(groupByColomboDay(points));
    expect(forecast.confidence).toBe("high");
    expect(forecast.bestDayOfWeek).not.toBeNull();
    expect(forecast.worstDayOfWeek).not.toBeNull();
  });
});

function daily(
  date: string,
  avgBuying: number,
  avgSelling: number,
): DailyAggregate {
  return {
    date,
    avgBuying,
    minBuying: avgBuying,
    maxBuying: avgBuying,
    avgSelling,
    minSelling: avgSelling,
    maxSelling: avgSelling,
    samples: 2,
  };
}

describe("longer-horizon assumptions", () => {
  it("blends all CBSL and bank calendar-day slopes", () => {
    const bankDaily = [
      daily("2026-08-01", 100, 110),
      daily("2026-08-02", 101, 111),
      daily("2026-08-03", 102, 112),
    ];
    const cbslDaily = [
      daily("2026-08-01", 200, 210),
      daily("2026-08-02", 202, 212),
      daily("2026-08-03", 204, 214),
    ];

    const assumptions = buildForecastAssumptions({ bankDaily, cbslDaily });

    expect(assumptions).not.toBeNull();
    expect(assumptions!.slopePerDay).toBeCloseTo(1.7, 4);
    expect(assumptions!.bankDaysCovered).toBe(3);
    expect(assumptions!.cbslDaysCovered).toBe(3);
    expect(assumptions!.horizons.map((item) => item.horizonDays)).toEqual([
      14, 30, 60,
    ]);
    expect(assumptions!.horizons[0].projectedBuying).toBeCloseTo(125.8, 4);
  });

  it("does not guess without enough history from both sources", () => {
    expect(
      buildForecastAssumptions({
        bankDaily: [daily("2026-08-01", 100, 110)],
        cbslDaily: [daily("2026-08-01", 100, 110)],
      }),
    ).toBeNull();
  });
});

describe("reference sources", () => {
  it("does not put CBSL or Google in the licensed-bank list", () => {
    const bankCodes = getEnabledBanks().map((b) => b.code);
    expect(bankCodes).not.toContain("CBSL");
    expect(bankCodes).not.toContain("GOOGLE");
    expect(getEnabledSources().some((b) => b.code === "CBSL")).toBe(true);
    expect(isReferenceSource("GOOGLE")).toBe(true);
    expect(isReferenceSource("SEYLAN")).toBe(false);
    expect(getEnabledSources().some((b) => b.code === "GOOGLE")).toBe(true);
  });
});

describe("reference signals", () => {
  it("compares a bank to CBSL official TT and Google mid without changing bank trend", () => {
    const bankDaily = [
      daily("2026-08-19", 320, 332),
      daily("2026-08-20", 321, 333),
      daily("2026-08-21", 322, 334),
    ];
    const bankForecast = buildForecast(bankDaily);
    const refs = buildReferenceSignals({
      bankCode: "SEYLAN",
      currency: "USD",
      bankDaily,
      bankTrend: bankForecast.trend,
      references: [
        {
          source: "CBSL",
          label: "CBSL official TT",
          quoteKind: "tt",
          daily: [
            daily("2026-08-19", 324, 333),
            daily("2026-08-20", 325, 334),
            daily("2026-08-21", 326, 335),
          ],
        },
        {
          source: "GOOGLE",
          label: "Google mid",
          quoteKind: "mid",
          daily: [daily("2026-08-21", 329.1, 329.1)],
        },
      ],
    });

    expect(bankForecast.trend?.direction).toBe("up");
    expect(refs.cbsl?.latestBuying).toBe(326);
    expect(refs.comparisons.find((c) => c.source === "CBSL")?.buyingSpread).toBe(-4);
    expect(refs.comparisons.find((c) => c.source === "GOOGLE")?.buyingSpread).toBe(
      -7.1,
    );
    expect(refs.comparisons.find((c) => c.source === "CBSL")?.alignment).toBe(
      "aligned",
    );
    expect(refs.combinedSignal).toMatch(/SEYLAN/);
  });

  it("marks opposite trends as diverging", () => {
    expect(
      trendAlignment(
        { direction: "up", pctChangePerDay: 0.2, projectedNextDayBuying: 1, projectedNextDaySelling: 2 },
        { direction: "down", pctChangePerDay: -0.1, projectedNextDayBuying: 1, projectedNextDaySelling: 2 },
      ),
    ).toBe("diverging");
  });

  it("returns a fallback message when no reference series loaded", () => {
    const refs = buildReferenceSignals({
      bankCode: "HNB",
      currency: "AUD",
      bankDaily: [daily("2026-08-21", 230, 241)],
      bankTrend: null,
      references: [],
      errors: { CBSL: "timeout" },
    });
    expect(refs.cbsl).toBeNull();
    expect(refs.combinedSignal).toMatch(/timeout/);
  });
});
