import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTtRatesFromHtmlTables } from "../shared/utils/html";
import {
  filterValidRates,
  parseRateNumber,
  ratesEqual,
  validateExchangeRate,
} from "../shared/utils/rates";
import type { ExchangeRate } from "../shared/types";

const fixtures = join(process.cwd(), "tests/fixtures");

function load(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

describe("parseRateNumber", () => {
  it("parses common formats", () => {
    expect(parseRateNumber("329.50")).toBe(329.5);
    expect(parseRateNumber("1,107.4763")).toBe(1107.4763);
    expect(parseRateNumber(2.0572)).toBe(2.0572);
  });

  it("rejects invalid values", () => {
    expect(parseRateNumber("-")).toBeNull();
    expect(parseRateNumber("N/A")).toBeNull();
    expect(parseRateNumber("")).toBeNull();
    expect(parseRateNumber(null)).toBeNull();
  });
});

describe("validateExchangeRate", () => {
  const base: ExchangeRate = {
    bankCode: "SEYLAN",
    currency: "USD",
    ttBuying: 329.5,
    ttSelling: 337,
    retrievedAt: new Date().toISOString(),
  };

  it("accepts valid TT rates", () => {
    expect(validateExchangeRate(base).valid).toBe(true);
  });

  it("rejects missing values", () => {
    expect(
      validateExchangeRate({ ...base, ttBuying: null, ttSelling: null }).valid,
    ).toBe(false);
  });

  it("rejects out-of-range values", () => {
    expect(validateExchangeRate({ ...base, ttBuying: 5 }).valid).toBe(false);
  });
});

describe("duplicate detection", () => {
  it("detects unchanged rates", () => {
    expect(
      ratesEqual(
        { ttBuying: 329.5, ttSelling: 337 },
        { ttBuying: 329.5, ttSelling: 337 },
      ),
    ).toBe(true);
    expect(
      ratesEqual(
        { ttBuying: 329.5, ttSelling: 337 },
        { ttBuying: 329.6, ttSelling: 337 },
      ),
    ).toBe(false);
  });
});

describe("HTML TT extraction", () => {
  it("extracts Commercial Bank TT buying/selling", () => {
    const { rates } = parseTtRatesFromHtmlTables({
      bankCode: "COMMERCIAL",
      html: load("commercial.html"),
      parserVersion: "test",
    });
    const usd = rates.find((r) => r.currency === "USD");
    expect(usd?.ttBuying).toBe(329);
    expect(usd?.ttSelling).toBe(337);
    // Must not pick Cheques buying 327.21
    expect(usd?.ttBuying).not.toBe(327.21);
    expect(rates.map((r) => r.currency).sort()).toEqual([
      "AUD",
      "EUR",
      "JPY",
      "SGD",
      "USD",
    ]);
  });

  it("extracts Seylan TT columns (not notes)", () => {
    const { rates } = parseTtRatesFromHtmlTables({
      bankCode: "SEYLAN",
      html: load("seylan.html"),
      parserVersion: "test",
      fallbackTtColumns: { buy: 6, sell: 7 },
      preferFallback: true,
    });
    const usd = rates.find((r) => r.currency === "USD");
    expect(usd?.ttBuying).toBe(329.6);
    expect(usd?.ttSelling).toBe(336.6);
    // Must NOT pick currency notes buying 328.85
    expect(usd?.ttBuying).not.toBe(328.85);
  });

  it("extracts NDB telegraphic transfer columns", () => {
    const { rates } = parseTtRatesFromHtmlTables({
      bankCode: "NDB",
      html: load("ndb.html"),
      parserVersion: "test",
    });
    const usd = rates.find((r) => r.currency === "USD");
    expect(usd?.ttBuying).toBe(329);
    expect(usd?.ttSelling).toBe(338);
  });

  it("does not insert invalid/missing TT values", () => {
    const { rates } = parseTtRatesFromHtmlTables({
      bankCode: "TEST",
      html: load("invalid.html"),
      parserVersion: "test",
    });
    expect(filterValidRates(rates)).toHaveLength(0);
  });
});

describe("Sampath JSON normalization", () => {
  it("maps TTBUY/TTSEL and drops invalid currencies", () => {
    const payload = JSON.parse(load("sampath.json")) as {
      data: Array<{ CurrCode: string; TTBUY: string; TTSEL: string }>;
    };
    const rates: ExchangeRate[] = payload.data.map((row) => ({
      bankCode: "SAMPATH",
      currency: row.CurrCode,
      ttBuying: parseRateNumber(row.TTBUY),
      ttSelling: parseRateNumber(row.TTSEL),
      retrievedAt: new Date().toISOString(),
    }));
    const valid = filterValidRates(rates);
    expect(valid).toHaveLength(2);
    expect(valid.find((r) => r.currency === "USD")?.ttBuying).toBe(329.5);
    expect(valid.find((r) => r.currency === "USD")?.ttSelling).toBe(337.5);
  });
});
