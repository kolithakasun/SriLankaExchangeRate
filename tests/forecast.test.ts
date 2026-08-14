import { describe, expect, it } from "vitest";
import {
  buildForecast,
  dayOfWeekAverages,
  groupByColomboDay,
  linearTrend,
  weekdayName,
} from "../shared/utils/forecast";
import type { HistoryPoint } from "../shared/types";

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
