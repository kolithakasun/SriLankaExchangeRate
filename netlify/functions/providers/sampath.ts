import { supportedCurrencyCodes } from "../../../shared/config/currencies.js";
import { filterValidRates, parseRateNumber } from "../../../shared/utils/rates.js";
import { nowIso, parseSourceTimestamp } from "../../../shared/utils/time.js";
import { fetchJson } from "../../../shared/utils/html.js";
import type { ExchangeRate, ProviderResult } from "../../../shared/types.js";
import type { BankExchangeRateProvider } from "./types.js";
import { PARSER_VERSION } from "./types.js";

/**
 * Sampath: Nuxt frontend loads JSON from:
 *   GET https://www.sampath.lk/api/exchange-rates
 * Fields TTBUY / TTSEL are Telegraphic Transfer rates.
 */
interface SampathRow {
  CurrCode?: string;
  CurrName?: string;
  TTBUY?: string | number;
  TTSEL?: string | number;
  RateWEF?: string;
}

interface SampathPayload {
  success?: boolean;
  data?: SampathRow[];
}

export const sampathProvider: BankExchangeRateProvider = {
  code: "SAMPATH",
  async fetchRates(): Promise<ProviderResult> {
    const retrievedAt = nowIso();
    try {
      const payload = await fetchJson<SampathPayload>(
        "https://www.sampath.lk/api/exchange-rates",
        {
          headers: {
            locale: "en",
            platform: "web",
          },
        },
      );

      const rows = payload.data ?? [];
      const sourceTimestamp =
        parseSourceTimestamp(rows[0]?.RateWEF) ?? null;

      const rates: ExchangeRate[] = [];
      for (const row of rows) {
        const currency = (row.CurrCode ?? "").trim().toUpperCase();
        if (!supportedCurrencyCodes.includes(currency)) continue;
        rates.push({
          bankCode: "SAMPATH",
          currency,
          ttBuying: parseRateNumber(row.TTBUY),
          ttSelling: parseRateNumber(row.TTSEL),
          sourceTimestamp: parseSourceTimestamp(row.RateWEF) ?? sourceTimestamp,
          retrievedAt,
          parserVersion: `sampath-api@${PARSER_VERSION}`,
          rawReference: "sampath.lk/api/exchange-rates",
        });
      }

      const valid = filterValidRates(rates);
      if (!valid.length) {
        return {
          bankCode: "SAMPATH",
          success: false,
          rates: [],
          error: "Could not find TT selling/buying rate in Sampath API",
          retrievedAt,
          sourceTimestamp,
        };
      }

      return {
        bankCode: "SAMPATH",
        success: true,
        rates: valid,
        retrievedAt,
        sourceTimestamp,
      };
    } catch (err) {
      return {
        bankCode: "SAMPATH",
        success: false,
        rates: [],
        error: err instanceof Error ? err.message : String(err),
        retrievedAt,
      };
    }
  },
};
