/**
 * Shared helpers for USDT/LKR P2P order-book snapshots.
 *
 * Mapping onto existing TT fields:
 * - ttBuying  = USDT → LKR (you sell USDT): maximum Bank Sri Lanka ad price
 * - ttSelling = LKR → USDT (you buy USDT): minimum Bank Sri Lanka ad price
 */

/** Binance P2P payType / method identifier matching payment=BankSriLanka. */
export const BINANCE_BANK_SRI_LANKA = "BankSriLanka";

/**
 * Bybit LKR "Bank Transfer" payment type id (same filter the P2P UI uses for
 * local bank rails; Binance's named BankSriLanka equivalent on Bybit).
 */
export const BYBIT_BANK_TRANSFER_PAYMENT_ID = "14";

export function pickBookPrice(
  prices: number[],
  direction: "highest" | "lowest",
): number | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (!clean.length) return null;
  const value =
    direction === "highest" ? Math.max(...clean) : Math.min(...clean);
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
