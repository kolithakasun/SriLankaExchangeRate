import { getBankByCode } from "../../../shared/config/banks.js";
import { filterValidRates } from "../../../shared/utils/rates.js";
import { nowIso } from "../../../shared/utils/time.js";
import {
  fetchText,
  parseTtRatesFromHtmlTables,
} from "../../../shared/utils/html.js";
import type { ProviderResult } from "../../../shared/types.js";
import { PARSER_VERSION } from "./types.js";

export async function fetchHtmlProvider(options: {
  bankCode: string;
  url?: string;
  fallbackTtColumns?: { buy: number; sell: number };
  preferFallback?: boolean;
  parserTag: string;
}): Promise<ProviderResult> {
  const retrievedAt = nowIso();
  const bank = getBankByCode(options.bankCode);
  const url = options.url ?? bank?.sourceUrl;
  if (!url) {
    return {
      bankCode: options.bankCode,
      success: false,
      rates: [],
      error: "Missing source URL",
      retrievedAt,
    };
  }

  try {
    const html = await fetchText(url);
    const { rates, sourceTimestamp } = parseTtRatesFromHtmlTables({
      bankCode: options.bankCode,
      html,
      parserVersion: `${options.parserTag}@${PARSER_VERSION}`,
      fallbackTtColumns: options.fallbackTtColumns,
      preferFallback: options.preferFallback,
    });
    const valid = filterValidRates(rates);
    if (!valid.length) {
      return {
        bankCode: options.bankCode,
        success: false,
        rates: [],
        error: "Could not find TT buying/selling rates in HTML",
        retrievedAt,
        sourceTimestamp,
      };
    }
    return {
      bankCode: options.bankCode,
      success: true,
      rates: valid,
      retrievedAt,
      sourceTimestamp,
    };
  } catch (err) {
    return {
      bankCode: options.bankCode,
      success: false,
      rates: [],
      error: err instanceof Error ? err.message : String(err),
      retrievedAt,
    };
  }
}
