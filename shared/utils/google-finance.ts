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
 * is a type tag, not the rate. Crypto pairs often use a labeled form such as
 * `"Tether (USDT / LKR)",3,null,[328.42,...],null,328.346`. Prefer the first
 * number in that array, then a decimal blob / hyphenated ticker. Never return
 * a value outside the currency's sanity range.
 */
export function parseGoogleFinanceMid(
  html: string,
  base: string,
  quote = "LKR",
): number | null {
  const code = base.toUpperCase();
  const quoteCode = quote.toUpperCase();
  const pair = `${code} / ${quoteCode}`;
  const escaped = pair.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const candidates: Array<number | null> = [];

  // Exact pair: "USD / LKR",3,null,[329.31
  candidates.push(
    parseRateNumber(
      html.match(
        new RegExp(`"${escaped}",\\d+,null,\\[([0-9]+(?:\\.[0-9]+)?)`),
      )?.[1],
    ),
  );

  // Labeled crypto: "Tether (USDT / LKR)",3,null,[328.42
  candidates.push(
    parseRateNumber(
      html.match(
        new RegExp(
          `"[^"]*\\(${escaped}\\)",\\d+,null,\\[([0-9]+(?:\\.[0-9]+)?)`,
        ),
      )?.[1],
    ),
  );

  // Trailing mid after labeled cluster: ...,null,328.346160011
  candidates.push(
    parseRateNumber(
      html.match(
        new RegExp(
          `"[^"]*\\(${escaped}\\)",\\d+,null,\\[[^\\]]+\\],null,([0-9]+(?:\\.[0-9]+)?)`,
        ),
      )?.[1],
    ),
  );

  // Hyphen ticker: "USDT-LKR","Tether (USDT / LKR)",328.346
  candidates.push(
    parseRateNumber(
      html.match(
        new RegExp(
          `"${code}-${quoteCode}"\\s*,\\s*"[^"]*"\\s*,\\s*([0-9]+(?:\\.[0-9]+)?)`,
        ),
      )?.[1],
    ),
  );

  for (const value of candidates) {
    if (value !== null && isRateInReasonableRange(code, value)) return value;
  }

  const decimals = [
    ...html.matchAll(new RegExp(`"${escaped}",([0-9]+\\.[0-9]+)`, "g")),
    ...html.matchAll(
      new RegExp(`"[^"]*\\(${escaped}\\)",([0-9]+\\.[0-9]+)`, "g"),
    ),
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
