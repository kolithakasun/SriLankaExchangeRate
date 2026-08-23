import { isRateInReasonableRange, parseRateNumber } from "./rates.js";

export const GOOGLE_FINANCE_QUOTE_URL = "https://www.google.com/finance/quote";

export function googleFinanceQuoteUrl(
  base: string,
  quote = "LKR",
): string {
  return `${GOOGLE_FINANCE_QUOTE_URL}/${base.toUpperCase()}-${quote.toUpperCase()}?hl=en`;
}

/**
 * Google Finance embeds quotes as `"USD / LKR",3,null,[329.31,...]` — the `3`
 * is a type tag, not the rate. Prefer the first number in that array, then a
 * decimal `"USD / LKR",329.1059` blob. Never return a value outside the
 * currency's sanity range.
 */
export function parseGoogleFinanceMid(
  html: string,
  base: string,
  quote = "LKR",
): number | null {
  const code = base.toUpperCase();
  const pair = `${code} / ${quote.toUpperCase()}`;
  const escaped = pair.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const clustered = html.match(
    new RegExp(`"${escaped}",\\d+,null,\\[([0-9]+(?:\\.[0-9]+)?)`),
  );
  const fromCluster = parseRateNumber(clustered?.[1]);
  if (fromCluster !== null && isRateInReasonableRange(code, fromCluster)) {
    return fromCluster;
  }

  const decimals = [
    ...html.matchAll(new RegExp(`"${escaped}",([0-9]+\\.[0-9]+)`, "g")),
  ]
    .map((match) => parseRateNumber(match[1]))
    .filter((n): n is number => n !== null && isRateInReasonableRange(code, n));
  if (decimals.length) return decimals[0];

  const dataPrice = parseRateNumber(
    html.match(/data-last-price="([0-9]+(?:\.[0-9]+)?)"/)?.[1],
  );
  if (dataPrice !== null && isRateInReasonableRange(code, dataPrice)) {
    return dataPrice;
  }

  return null;
}
