import { fetchJson } from "../../../shared/utils/html.js";
import {
  BYBIT_BANK_TRANSFER_PAYMENT_ID,
  pickBookPrice,
} from "../../../shared/utils/p2p.js";
import { filterValidRates } from "../../../shared/utils/rates.js";
import { nowIso } from "../../../shared/utils/time.js";
import type { ExchangeRate, ProviderResult } from "../../../shared/types.js";
import type { BankExchangeRateProvider } from "./types.js";
import { PARSER_VERSION } from "./types.js";

/** Public Bybit P2P order book used by the website (no API key). */
const ONLINE_URL = "https://api2.bybit.com/fiat/otc/item/online";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface BybitItem {
  price?: string;
  payments?: string[];
  side?: number | string;
}

interface BybitOnlineResponse {
  ret_code?: number;
  ret_msg?: string;
  result?: { items?: BybitItem[]; count?: number };
}

async function searchPrices(side: "0" | "1"): Promise<number[]> {
  // Bybit side is the *advertiser* side of the token:
  //   side 0 = advertisers buying USDT  → you sell USDT (sell page)
  //   side 1 = advertisers selling USDT → you buy USDT (buy page)
  // API returns competitive order: side0 highest-first, side1 lowest-first.
  const body = {
    userId: "",
    tokenId: "USDT",
    currencyId: "LKR",
    payment: [BYBIT_BANK_TRANSFER_PAYMENT_ID],
    side,
    size: "20",
    page: "1",
    amount: "",
    authMaker: false,
    canTrade: false,
  };

  const data = await fetchJson<BybitOnlineResponse>(ONLINE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
    },
    body: JSON.stringify(body),
  });

  if (data.ret_code !== 0) {
    throw new Error(data.ret_msg || `Bybit P2P error ${data.ret_code}`);
  }

  const prices: number[] = [];
  for (const item of data.result?.items ?? []) {
    const payments = item.payments ?? [];
    if (!payments.includes(BYBIT_BANK_TRANSFER_PAYMENT_ID)) continue;
    const price = Number(item.price);
    if (Number.isFinite(price) && price > 0) prices.push(price);
  }
  return prices;
}

export const bybitP2pProvider: BankExchangeRateProvider = {
  code: "BYBIT_P2P",
  async fetchRates(): Promise<ProviderResult> {
    const retrievedAt = nowIso();
    try {
      const [sellPrices, buyPrices] = await Promise.all([
        searchPrices("0"), // sell USDT (matches /p2p/sell/USDT/LKR)
        searchPrices("1"), // buy USDT (matches /p2p/buy/USDT/LKR)
      ]);

      // Top-of-book: highest bid when selling, lowest ask when buying.
      const ttBuying = pickBookPrice(sellPrices, "highest");
      const ttSelling = pickBookPrice(buyPrices, "lowest");

      if (ttBuying === null && ttSelling === null) {
        return {
          bankCode: "BYBIT_P2P",
          success: false,
          rates: [],
          error: "Bybit P2P returned no Bank Transfer USDT/LKR ads",
          retrievedAt,
        };
      }

      const rate: ExchangeRate = {
        bankCode: "BYBIT_P2P",
        currency: "USDT",
        ttBuying,
        ttSelling,
        // Live order book — source time is the moment we observed it.
        sourceTimestamp: retrievedAt,
        retrievedAt,
        parserVersion: `bybit-p2p@${PARSER_VERSION}`,
        rawReference: `${ONLINE_URL}?token=USDT&fiat=LKR&payment=${BYBIT_BANK_TRANSFER_PAYMENT_ID}`,
      };

      const valid = filterValidRates([rate]);
      if (!valid.length) {
        return {
          bankCode: "BYBIT_P2P",
          success: false,
          rates: [],
          error: "Bybit P2P rates failed validation",
          retrievedAt,
        };
      }

      return {
        bankCode: "BYBIT_P2P",
        success: true,
        rates: valid,
        retrievedAt,
        sourceTimestamp: retrievedAt,
      };
    } catch (err) {
      return {
        bankCode: "BYBIT_P2P",
        success: false,
        rates: [],
        error: err instanceof Error ? err.message : String(err),
        retrievedAt,
      };
    }
  },
};
