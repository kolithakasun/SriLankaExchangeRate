import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProviderResult } from "../shared/types";

/**
 * Exercises the local JSON store (used when Supabase env vars are absent) to
 * verify the day-boundary rules that also drive the Supabase path.
 */
let store: typeof import("../netlify/functions/lib/store.js");
let workDir: string;
const originalTmp = process.env.TMPDIR;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function result(retrievedAt: string, ttBuying: number, ttSelling: number): ProviderResult {
  return {
    bankCode: "SEYLAN",
    success: true,
    retrievedAt,
    rates: [
      {
        bankCode: "SEYLAN",
        currency: "AUD",
        ttBuying,
        ttSelling,
        retrievedAt,
        sourceTimestamp: null,
        parserVersion: "test",
      },
    ],
  };
}

function colomboIso(dateKey: string, hour: string): string {
  return new Date(`${dateKey}T${hour}:00:00+05:30`).toISOString();
}

/** Colombo date key N days before now, matching the store's own bucketing. */
function dayKeyAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), "sl-rates-test-"));
  process.env.TMPDIR = workDir;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  store = await import("../netlify/functions/lib/store.js");
});

afterAll(() => {
  if (originalTmp === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = originalTmp;
  if (originalUrl !== undefined) process.env.SUPABASE_URL = originalUrl;
  if (originalKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  rmSync(workDir, { recursive: true, force: true });
});

describe("local store day boundaries", () => {
  it("creates a record for a new day even when the rate has not moved", async () => {
    const twoDaysAgo = await store.persistProviderResults([
      result(colomboIso(dayKeyAgo(2), "09"), 200, 210),
    ]);
    expect(twoDaysAgo).toMatchObject({ inserted: 1, dailyCreated: 1, dailyUpdated: 0 });

    const yesterdaySameRate = await store.persistProviderResults([
      result(colomboIso(dayKeyAgo(1), "09"), 200, 210),
    ]);
    expect(yesterdaySameRate).toMatchObject({
      inserted: 1,
      dailyCreated: 1,
      dailyUpdated: 0,
    });
  });

  it("skips repeated same-day checks but records an intraday move", async () => {
    const first = await store.persistProviderResults([
      result(colomboIso(dayKeyAgo(0), "09"), 200, 210),
    ]);
    expect(first).toMatchObject({ inserted: 1, dailyCreated: 1 });

    const repeat = await store.persistProviderResults([
      result(colomboIso(dayKeyAgo(0), "11"), 200, 210),
    ]);
    expect(repeat).toMatchObject({ inserted: 0, dailyCreated: 0, dailyUpdated: 0 });

    const moved = await store.persistProviderResults([
      result(colomboIso(dayKeyAgo(0), "15"), 202.5, 212.5),
    ]);
    expect(moved).toMatchObject({ inserted: 1, dailyCreated: 0, dailyUpdated: 1 });
  });

  it("returns one daily point per checked day with the day's latest rate", async () => {
    const { daily } = await store.getDailyHistory({
      bank: "SEYLAN",
      currency: "AUD",
      days: 30,
    });

    expect(daily.map((d) => d.date)).toEqual([dayKeyAgo(2), dayKeyAgo(1), dayKeyAgo(0)]);
    expect(daily[0]).toMatchObject({ ttBuying: 200, changeCount: 0 });
    expect(daily[2]).toMatchObject({
      openTtBuying: 200,
      ttBuying: 202.5,
      changeCount: 1,
    });
  });
});
