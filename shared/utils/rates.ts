import { getCurrency, supportedCurrencyCodes } from "../config/currencies.js";
import type { ExchangeRate } from "../types.js";

const DEFAULT_MIN = 0.01;
const DEFAULT_MAX = 5000;

/** Reasonable LKR-per-unit bounds by currency (loose, for sanity checks). */
const RANGE_HINTS: Record<string, { min: number; max: number }> = {
  USD: { min: 50, max: 1000 },
  AUD: { min: 30, max: 800 },
  EUR: { min: 50, max: 1200 },
  JPY: { min: 0.1, max: 20 },
  SGD: { min: 30, max: 800 },
};

export function parseRateNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw || /^[-–—]|n\/?a|nil|null|none|\.+$/i.test(raw)) {
    return null;
  }

  const cleaned = raw.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;

  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

export function isRateInReasonableRange(
  currency: string,
  rate: number | null,
): boolean {
  if (rate === null) return false;
  const hint = RANGE_HINTS[currency] ?? { min: DEFAULT_MIN, max: DEFAULT_MAX };
  return rate >= hint.min && rate <= hint.max;
}

export function validateExchangeRate(
  rate: ExchangeRate,
  allowedCurrencies: string[] = supportedCurrencyCodes,
): { valid: boolean; reason?: string } {
  if (!rate.bankCode) return { valid: false, reason: "Missing bankCode" };
  if (!isValidCurrencyCode(rate.currency)) {
    return { valid: false, reason: `Invalid currency: ${rate.currency}` };
  }
  if (!allowedCurrencies.includes(rate.currency)) {
    return { valid: false, reason: `Currency not enabled: ${rate.currency}` };
  }
  if (rate.ttBuying === null && rate.ttSelling === null) {
    return { valid: false, reason: "Both TT rates missing" };
  }
  if (rate.ttBuying !== null && !isRateInReasonableRange(rate.currency, rate.ttBuying)) {
    return { valid: false, reason: `TT buying out of range: ${rate.ttBuying}` };
  }
  if (
    rate.ttSelling !== null &&
    !isRateInReasonableRange(rate.currency, rate.ttSelling)
  ) {
    return { valid: false, reason: `TT selling out of range: ${rate.ttSelling}` };
  }
  if (
    rate.ttBuying !== null &&
    rate.ttSelling !== null &&
    rate.ttBuying > rate.ttSelling * 1.05
  ) {
    // Buying above selling is unusual; allow small inversions but flag large ones
    return {
      valid: false,
      reason: `Buying (${rate.ttBuying}) exceeds selling (${rate.ttSelling})`,
    };
  }
  return { valid: true };
}

export function filterValidRates(rates: ExchangeRate[]): ExchangeRate[] {
  return rates.filter((r) => validateExchangeRate(r).valid);
}

export function ratesEqual(
  a: { ttBuying: number | null; ttSelling: number | null },
  b: { ttBuying: number | null; ttSelling: number | null },
): boolean {
  return a.ttBuying === b.ttBuying && a.ttSelling === b.ttSelling;
}

export function formatRate(
  value: number | null | undefined,
  currency?: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const cfg = currency ? getCurrency(currency) : undefined;
  const decimals =
    cfg?.decimals ??
    (Math.abs(value) < 10 ? 4 : Math.abs(value) < 100 ? 3 : 2);

  return value.toLocaleString("en-LK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
