/**
 * Shared helpers for USDT/LKR P2P order-book snapshots.
 *
 * Mapping onto existing TT fields (same sense as bank TT):
 * - ttBuying  = you sell USDT for LKR → best (highest) bid on the sell book
 * - ttSelling = you buy USDT with LKR → best (lowest) ask on the buy book
 *
 * Prefer the competitive top of book. Absolute min/max across the whole page
 * can pick outlier ads (e.g. 325 / 349) that the UI does not show first.
 */

/** Binance P2P payType matching payment=BankSriLanka. */
export const BINANCE_BANK_SRI_LANKA = "BankSriLanka";

/**
 * Bybit LKR Bank Transfer payment type id (Bybit has no "BankSriLanka" string).
 */
export const BYBIT_BANK_TRANSFER_PAYMENT_ID = "14";

/**
 * Competitive top-of-book price from the first `window` ads (API order).
 * - highest: best bid when selling USDT
 * - lowest: best ask when buying USDT
 */
export function pickBookPrice(
  prices: number[],
  direction: "highest" | "lowest",
  window = 5,
): number | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (!clean.length) return null;
  const sample = clean.slice(0, Math.min(window, clean.length));
  const value =
    direction === "highest" ? Math.max(...sample) : Math.min(...sample);
  return Number(value.toFixed(4));
}

export function isBinanceBankSriLanka(method: {
  identifier?: string | null;
  tradeMethodName?: string | null;
}): boolean {
  const id = (method.identifier ?? "").trim();
  if (id === BINANCE_BANK_SRI_LANKA) return true;
  const name = (method.tradeMethodName ?? "").toLowerCase();
  return name.includes("bank transfer (sri lanka)");
}
