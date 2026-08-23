import { supportedCurrencyCodes } from "../../../shared/config/currencies.js";
import {
  googleFinanceQuoteUrl,
  parseGoogleFinanceMid,
} from "../../../shared/utils/google-finance.js";
import { fetchText } from "../../../shared/utils/html.js";
import { filterValidRates, isRateInReasonableRange } from "../../../shared/utils/rates.js";
import { nowIso } from "../../../shared/utils/time.js";
import type { ExchangeRate, ProviderResult } from "../../../shared/types.js";
import type { BankExchangeRateProvider } from "./types.js";
import { PARSER_VERSION } from "./types.js";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchGoogleMid(currency: string): Promise<number | null> {
  const url = googleFinanceQuoteUrl(currency, "LKR");
  const html = await fetchText(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  const mid = parseGoogleFinanceMid(html, currency, "LKR");
  if (mid === null || !isRateInReasonableRange(currency, mid)) return null;
  return mid;
}

export const googleProvider: BankExchangeRateProvider = {
  code: "GOOGLE",
  async fetchRates(): Promise<ProviderResult> {
    const retrievedAt = nowIso();
    try {
      const rates: ExchangeRate[] = [];
      const results = await Promise.allSettled(
        supportedCurrencyCodes.map(async (currency) => {
          const mid = await fetchGoogleMid(currency);
          if (mid === null) {
            throw new Error(`No Google Finance mid for ${currency}/LKR`);
          }
          return {
            bankCode: "GOOGLE" as const,
            currency,
            // Mid-market quote — stored on both sides so existing TT fields work.
            ttBuying: mid,
            ttSelling: mid,
            retrievedAt,
            parserVersion: `google-finance@${PARSER_VERSION}`,
            rawReference: googleFinanceQuoteUrl(currency, "LKR"),
          } satisfies ExchangeRate;
        }),
      );

      const errors: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") rates.push(result.value);
        else {
          errors.push(
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          );
        }
      }

      const valid = filterValidRates(rates);
      if (!valid.length) {
        return {
          bankCode: "GOOGLE",
          success: false,
          rates: [],
          error: errors.join("; ") || "Google Finance returned no mids",
          retrievedAt,
        };
      }

      return {
        bankCode: "GOOGLE",
        success: true,
        rates: valid,
        retrievedAt,
        error: errors.length ? errors.join("; ") : undefined,
      };
    } catch (err) {
      return {
        bankCode: "GOOGLE",
        success: false,
        rates: [],
        error: err instanceof Error ? err.message : String(err),
        retrievedAt,
      };
    }
  },
};
