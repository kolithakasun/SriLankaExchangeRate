/**
 * Shared helpers for USDT/LKR P2P order-book snapshots.
 *
 * Mapping onto existing TT fields:
 * - ttBuying  = USDT → LKR (you sell USDT): average of the highest N bank-transfer ads
 * - ttSelling = LKR → USDT (you buy USDT): average of the lowest N bank-transfer ads
 */

export const P2P_TOP_N = 2;

export function averageTopPrices(
  prices: number[],
  options: { take: number; direction: "highest" | "lowest" },
): number | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (!clean.length) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const slice =
    options.direction === "highest"
      ? sorted.slice(-options.take)
      : sorted.slice(0, options.take);
  if (!slice.length) return null;
  const avg = slice.reduce((sum, p) => sum + p, 0) / slice.length;
  return Number(avg.toFixed(4));
}

export function isBankTransferMethodName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes("bank") && !n.includes("mobile") && !n.includes("airtime");
}
