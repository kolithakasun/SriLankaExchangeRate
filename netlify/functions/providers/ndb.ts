import { fetchHtmlProvider } from "./base.js";
import type { BankExchangeRateProvider } from "./types.js";

/** NDB: HTML table with explicit Telegraphic Transfer Buying/Selling columns. */
export const ndbProvider: BankExchangeRateProvider = {
  code: "NDB",
  async fetchRates() {
    return fetchHtmlProvider({
      bankCode: "NDB",
      parserTag: "ndb-html",
      fallbackTtColumns: { buy: 6, sell: 7 },
    });
  },
};
