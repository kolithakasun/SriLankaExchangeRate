import { fetchHtmlProvider } from "./base.js";
import type { BankExchangeRateProvider } from "./types.js";

/**
 * People's Bank: WordPress HTML table.
 * Columns: Currency Notes | TC's Drafts | Telegraphic Transfers.
 */
export const peoplesProvider: BankExchangeRateProvider = {
  code: "PEOPLES",
  async fetchRates() {
    return fetchHtmlProvider({
      bankCode: "PEOPLES",
      parserTag: "peoples-html",
      // Data: [name, notesBuy, notesSell, tcBuy, tcSell, ttBuy, ttSell]
      fallbackTtColumns: { buy: 5, sell: 6 },
      preferFallback: true,
    });
  },
};
