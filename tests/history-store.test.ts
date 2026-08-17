import { describe, expect, it } from "vitest";
import { decideObservation } from "../shared/utils/rates";
import {
  summarizeDailySeries,
  toDailySeries,
} from "../shared/utils/history";
import { getRangeDays, isHistoryRange } from "../shared/config/ranges";
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

describe("decideObservation", () => {
  it("records the very first observation", () => {
    expect(
      decideObservation({
        previous: null,
        current: { ttBuying: 200, ttSelling: 210 },
        dateKey: "2026-08-17",
      }),
    ).toEqual({ record: true, reason: "first" });
  });

  it("records a new day even when the rate is unchanged", () => {
    expect(
      decideObservation({
        previous: { ttBuying: 200, ttSelling: 210, dateKey: "2026-08-16" },
        current: { ttBuying: 200, ttSelling: 210 },
        dateKey: "2026-08-17",
      }),
    ).toEqual({ record: true, reason: "new-day" });
  });

  it("records an intraday change", () => {
    expect(
      decideObservation({
        previous: { ttBuying: 200, ttSelling: 210, dateKey: "2026-08-17" },
        current: { ttBuying: 201.5, ttSelling: 210 },
        dateKey: "2026-08-17",
      }),
    ).toEqual({ record: true, reason: "changed" });
  });

  it("skips a repeated check within the same day", () => {
    expect(
      decideObservation({
        previous: { ttBuying: 200, ttSelling: 210, dateKey: "2026-08-17" },
        current: { ttBuying: 200, ttSelling: 210 },
        dateKey: "2026-08-17",
      }),
    ).toEqual({ record: false, reason: "unchanged" });
  });

  it("treats a missing rate as a change", () => {
    expect(
      decideObservation({
        previous: { ttBuying: 200, ttSelling: 210, dateKey: "2026-08-17" },
        current: { ttBuying: 200, ttSelling: null },
        dateKey: "2026-08-17",
      }).reason,
    ).toBe("changed");
  });
});

describe("toDailySeries", () => {
  it("keeps open and close values per Colombo day", () => {
    const daily = toDailySeries([
      point("2026-08-14", "09", 200, 210),
      point("2026-08-14", "15", 201, 211),
      point("2026-08-17", "10", 203, 213),
    ]);

    expect(daily.map((d) => d.date)).toEqual(["2026-08-14", "2026-08-17"]);
    expect(daily[0]).toMatchObject({
      openTtBuying: 200,
      ttBuying: 201,
      openTtSelling: 210,
      ttSelling: 211,
      observations: 2,
      changeCount: 1,
    });
    expect(daily[1]).toMatchObject({ ttBuying: 203, changeCount: 0, observations: 1 });
  });

  it("sorts days ascending regardless of input order", () => {
    const daily = toDailySeries([
      point("2026-08-17", "10", 203, 213),
      point("2026-08-14", "09", 200, 210),
    ]);
    expect(daily.map((d) => d.date)).toEqual(["2026-08-14", "2026-08-17"]);
  });

  it("returns an empty series for no observations", () => {
    expect(toDailySeries([])).toEqual([]);
  });
});

describe("summarizeDailySeries", () => {
  it("reports high, low and net change across the range", () => {
    const daily = toDailySeries([
      point("2026-08-14", "09", 200, 210),
      point("2026-08-15", "09", 205, 215),
      point("2026-08-16", "09", 198, 208),
    ]);
    const summary = summarizeDailySeries(daily);

    expect(summary).toMatchObject({
      days: 3,
      firstDate: "2026-08-14",
      lastDate: "2026-08-16",
      highBuying: 205,
      lowBuying: 198,
      netBuyingChange: -2,
    });
  });

  it("handles an empty series", () => {
    expect(summarizeDailySeries([])).toMatchObject({
      days: 0,
      highBuying: null,
      netBuyingChange: null,
    });
  });
});

describe("history ranges", () => {
  it("maps range keys to day counts", () => {
    expect(getRangeDays("1w")).toBe(7);
    expect(getRangeDays("1m")).toBe(30);
    expect(getRangeDays("1y")).toBe(365);
  });

  it("validates range keys", () => {
    expect(isHistoryRange("3m")).toBe(true);
    expect(isHistoryRange("2y")).toBe(false);
  });
});
