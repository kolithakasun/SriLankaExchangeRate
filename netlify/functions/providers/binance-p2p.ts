import { fetchJson } from "../../../shared/utils/html.js";
import {
  BINANCE_BANK_SRI_LANKA,
  isBinanceBankSriLanka,
  pickBookPrice,
} from "../../../shared/utils/p2p.js";
import { filterValidRates } from "../../../shared/utils/rates.js";
import { nowIso } from "../../../shared/utils/time.js";
import type { ExchangeRate, ProviderResult } from "../../../shared/types.js";
import type { BankExchangeRateProvider } from "./types.js";
import { PARSER_VERSION } from "./types.js";

const SEARCH_URL =
  "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface BinanceAdv {
  adv?: {
    price?: string;
    tradeMethods?: Array<{
      identifier?: string;
      tradeMethodName?: string;
    }>;
  };
}

interface BinanceSearchResponse {
  code?: string;
  success?: boolean;
  data?: BinanceAdv[];
  message?: string | null;
}

async function searchPrices(tradeType: "BUY" | "SELL"): Promise<number[]> {
  // tradeType is from the taker's perspective: SELL = you sell USDT (buyers' ads).
  const body = {
    asset: "USDT",
    fiat: "LKR",
    tradeType,
    page: 1,
    rows: 20,
    payTypes: [BINANCE_BANK_SRI_LANKA],
    publisherType: null,
    countries: [],
    proMerchantAds: false,
    shieldMerchantAds: false,
    filterType: "all",
    periods: [],
    additionalKycVerifyFilter: 0,
    classifies: ["mass", "profession", "fiat_trade"],
  };

  const data = await fetchJson<BinanceSearchResponse>(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
      clienttype: "web",
    },
    body: JSON.stringify(body),
  });

  if (data.code && data.code !== "000000") {
    throw new Error(data.message || `Binance P2P error ${data.code}`);
  }

  const prices: number[] = [];
  for (const row of data.data ?? []) {
    const methods = row.adv?.tradeMethods ?? [];
    // Require BankSriLanka on the ad (exclude generic BANK-only / airtime).
    if (!methods.some((m) => isBinanceBankSriLanka(m))) continue;
    const price = Number(row.adv?.price);
    if (Number.isFinite(price) && price > 0) prices.push(price);
  }
  return prices;
}

export const binanceP2pProvider: BankExchangeRateProvider = {
  code: "BINANCE_P2P",
  async fetchRates(): Promise<ProviderResult> {
    const retrievedAt = nowIso();
    try {
      const [sellPrices, buyPrices] = await Promise.all([
        searchPrices("SELL"),
        searchPrices("BUY"),
      ]);

      // Sell USDT → max LKR; buy USDT → min LKR.
      const ttBuying = pickBookPrice(sellPrices, "highest");
      const ttSelling = pickBookPrice(buyPrices, "lowest");

      if (ttBuying === null && ttSelling === null) {
        return {
          bankCode: "BINANCE_P2P",
          success: false,
          rates: [],
          error: "Binance P2P returned no BankSriLanka USDT/LKR ads",
          retrievedAt,
        };
      }

      const rate: ExchangeRate = {
        bankCode: "BINANCE_P2P",
        currency: "USDT",
        ttBuying,
        ttSelling,
        // Live order book — source time is the moment we observed it.
        sourceTimestamp: retrievedAt,
        retrievedAt,
        parserVersion: `binance-p2p@${PARSER_VERSION}`,
        rawReference: `${SEARCH_URL}?asset=USDT&fiat=LKR&payTypes=${BINANCE_BANK_SRI_LANKA}`,
      };

      const valid = filterValidRates([rate]);
      if (!valid.length) {
        return {
          bankCode: "BINANCE_P2P",
          success: false,
          rates: [],
          error: "Binance P2P rates failed validation",
          retrievedAt,
        };
      }

      return {
        bankCode: "BINANCE_P2P",
        success: true,
        rates: valid,
        retrievedAt,
        sourceTimestamp: retrievedAt,
      };
    } catch (err) {
      return {
        bankCode: "BINANCE_P2P",
        success: false,
        rates: [],
        error: err instanceof Error ? err.message : String(err),
        retrievedAt,
      };
    }
  },
};
