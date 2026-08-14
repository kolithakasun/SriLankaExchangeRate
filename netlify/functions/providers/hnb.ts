import { supportedCurrencyCodes } from "../../../shared/config/currencies.js";
import { filterValidRates, parseRateNumber } from "../../../shared/utils/rates.js";
import { nowIso, parseSourceTimestamp } from "../../../shared/utils/time.js";
import { fetchJson } from "../../../shared/utils/html.js";
import type { ExchangeRate, ProviderResult } from "../../../shared/types.js";
import type { BankExchangeRateProvider } from "./types.js";
import { PARSER_VERSION } from "./types.js";

/**
 * HNB serves a React SPA. Rates come from Venus API:
 *   GET https://venus.hnb.lk/api/get_rates_contents_web
 * UI labels these as Telegraphic Transfer buying/selling rates.
 */
interface HnbRateRow {
  currency?: string;
  currencyCode?: string;
  buyingRate?: number | string;
  sellingRate?: number | string;
  updated_on?: string;
  status?: string;
}

interface HnbRatesPayload {
  ex?: HnbRateRow[];
}

interface HnbLastUpdate {
  lastUpdatedDate?: string;
}

export const hnbProvider: BankExchangeRateProvider = {
  code: "HNB",
  async fetchRates(): Promise<ProviderResult> {
    const retrievedAt = nowIso();
    try {
      const [payload, lastUpdate] = await Promise.all([
        fetchJson<HnbRatesPayload | HnbRateRow[]>(
          "https://venus.hnb.lk/api/get_rates_contents_web",
        ),
        fetchJson<HnbLastUpdate[]>(
          "https://venus.hnb.lk/api/get_exchange_rate_last_update_date_contents",
        ).catch(() => [] as HnbLastUpdate[]),
      ]);

      const rows: HnbRateRow[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.ex)
          ? payload.ex
          : [];

      if (!rows.length) {
        // Fallback to simpler endpoint
        const simple = await fetchJson<HnbRateRow[]>(
          "https://venus.hnb.lk/api/get_exchange_rates_contents_web",
        );
        rows.push(...simple);
      }

      const sourceTimestamp =
        parseSourceTimestamp(rows.find((r) => r.updated_on)?.updated_on) ??
        parseSourceTimestamp(lastUpdate?.[0]?.lastUpdatedDate) ??
        null;

      const rates: ExchangeRate[] = [];
      for (const row of rows) {
        const currency = (row.currencyCode ?? "").toUpperCase();
        if (!supportedCurrencyCodes.includes(currency)) continue;
        rates.push({
          bankCode: "HNB",
          currency,
          ttBuying: parseRateNumber(row.buyingRate),
          ttSelling: parseRateNumber(row.sellingRate),
          sourceTimestamp:
            parseSourceTimestamp(row.updated_on) ?? sourceTimestamp,
          retrievedAt,
          parserVersion: `hnb-api@${PARSER_VERSION}`,
          rawReference: "venus.hnb.lk/api/get_rates_contents_web",
        });
      }

      const valid = filterValidRates(rates);
      if (!valid.length) {
        return {
          bankCode: "HNB",
          success: false,
          rates: [],
          error: "HNB API returned no valid TT rates",
          retrievedAt,
          sourceTimestamp,
        };
      }

      return {
        bankCode: "HNB",
        success: true,
        rates: valid,
        retrievedAt,
        sourceTimestamp,
      };
    } catch (err) {
      return {
        bankCode: "HNB",
        success: false,
        rates: [],
        error: err instanceof Error ? err.message : String(err),
        retrievedAt,
      };
    }
  },
};
