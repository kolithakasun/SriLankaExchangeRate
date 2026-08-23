import { supportedCurrencyCodes } from "../../../shared/config/currencies.js";
import {
  CBSL_CHART_BASE_URL,
  CBSL_TT_FORM_URL,
  CBSL_TT_FORM_VALUES,
  CBSL_TT_RESULTS_URL,
  cbslChartUrl,
  cbslRowsToHistory,
  latestCbslRates,
  parseCbslChartWidget,
  parseCbslTtResultsHtml,
  type CbslTtRow,
} from "../../../shared/utils/cbsl.js";
import { colomboDateKeyDaysAgo } from "../../../shared/utils/history.js";
import { fetchText } from "../../../shared/utils/html.js";
import { filterValidRates } from "../../../shared/utils/rates.js";
import { colomboDateKey, nowIso } from "../../../shared/utils/time.js";
import type { ExchangeRate, HistoryPoint, ProviderResult } from "../../../shared/types.js";
import type { BankExchangeRateProvider } from "./types.js";
import { PARSER_VERSION } from "./types.js";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const LOOKBACK_DAYS_LATEST = 7;

export async function fetchCbslTtRows(options?: {
  days?: number;
  currencies?: string[];
}): Promise<CbslTtRow[]> {
  const days = options?.days ?? LOOKBACK_DAYS_LATEST;
  const currencies = (options?.currencies ?? supportedCurrencyCodes).filter(
    (code) => CBSL_TT_FORM_VALUES[code],
  );
  if (!currencies.length) return [];

  const end = colomboDateKey();
  const start = colomboDateKeyDaysAgo(Math.max(days - 1, 0));
  const body = new URLSearchParams();
  body.set("lookupPage", "lookup_daily_exchange_rates.php");
  body.set("startRange", "2006-11-11");
  body.set("rangeType", "dates");
  body.set("txtStart", start);
  body.set("txtEnd", end);
  body.set("submit_button", "Submit");
  for (const code of currencies) {
    body.append("chk_cur[]", CBSL_TT_FORM_VALUES[code]);
  }

  const html = await fetchText(CBSL_TT_RESULTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": BROWSER_UA,
      Referer: CBSL_TT_FORM_URL,
    },
    body: body.toString(),
  });

  return parseCbslTtResultsHtml(html);
}

export async function fetchCbslHistory(options?: {
  days?: number;
  currencies?: string[];
}): Promise<HistoryPoint[]> {
  const rows = await fetchCbslTtRows(options);
  return cbslRowsToHistory(rows, nowIso());
}

async function chartFallback(
  currencies: string[],
  retrievedAt: string,
): Promise<ExchangeRate[]> {
  const rates: ExchangeRate[] = [];
  await Promise.all(
    currencies.map(async (currency) => {
      try {
        const html = await fetchText(cbslChartUrl(currency), {
          headers: { "User-Agent": BROWSER_UA },
        });
        const parsed = parseCbslChartWidget(html);
        if (parsed.buy === null && parsed.sell === null) return;
        rates.push({
          bankCode: "CBSL",
          currency,
          ttBuying: parsed.buy,
          ttSelling: parsed.sell,
          retrievedAt,
          parserVersion: `cbsl-chart@${PARSER_VERSION}`,
          rawReference: `${CBSL_CHART_BASE_URL}/${currency.toLowerCase()}/indexsmall.php`,
        });
      } catch {
        // Keep other currencies if one widget fails.
      }
    }),
  );
  return rates;
}

export const cbslProvider: BankExchangeRateProvider = {
  code: "CBSL",
  async fetchRates(): Promise<ProviderResult> {
    const retrievedAt = nowIso();
    const currencies = supportedCurrencyCodes.filter((code) => CBSL_TT_FORM_VALUES[code]);
    try {
      const rows = await fetchCbslTtRows({
        days: LOOKBACK_DAYS_LATEST,
        currencies,
      });
      let rates = filterValidRates(
        latestCbslRates(rows, retrievedAt, `cbsl-tt@${PARSER_VERSION}`),
      );

      if (!rates.length) {
        rates = filterValidRates(await chartFallback(currencies, retrievedAt));
      }

      if (!rates.length) {
        return {
          bankCode: "CBSL",
          success: false,
          rates: [],
          error: "CBSL TT search returned no buy/sell rates",
          retrievedAt,
        };
      }

      return {
        bankCode: "CBSL",
        success: true,
        rates,
        retrievedAt,
        sourceTimestamp: rates[0]?.sourceTimestamp ?? null,
      };
    } catch (err) {
      return {
        bankCode: "CBSL",
        success: false,
        rates: [],
        error: err instanceof Error ? err.message : String(err),
        retrievedAt,
      };
    }
  },
};
