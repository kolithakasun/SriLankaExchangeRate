import { fetchHtmlProvider } from "./base.js";
import type { BankExchangeRateProvider } from "./types.js";

/**
 * Bank of Ceylon: HTML table on rates-tariff.
 * Columns: Currency Notes | Drafts | Telegraphic/PFCA/BFCA Transfers.
 */
export const bocProvider: BankExchangeRateProvider = {
  code: "BOC",
  async fetchRates() {
    return fetchHtmlProvider({
      bankCode: "BOC",
      parserTag: "boc-html",
      fallbackTtColumns: { buy: 5, sell: 6 },
    });
  },
};
