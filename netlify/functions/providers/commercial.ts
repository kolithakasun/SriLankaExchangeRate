import { fetchHtmlProvider } from "./base.js";
import type { BankExchangeRateProvider } from "./types.js";

/**
 * Commercial Bank: HTML table on rates-tariff page.
 * Group headers: Currency (notes) | Cheques | Telegraphic Transfers.
 * Data row includes a leading currency-name cell.
 */
export const commercialProvider: BankExchangeRateProvider = {
  code: "COMMERCIAL",
  async fetchRates() {
    return fetchHtmlProvider({
      bankCode: "COMMERCIAL",
      url: "https://www.combank.lk/rates-tariff",
      parserTag: "commercial-html",
      // Data row: [name, notesBuy, notesSell, chequeBuy, chequeSell, ttBuy, ttSell]
      fallbackTtColumns: { buy: 5, sell: 6 },
      preferFallback: true,
    });
  },
};
