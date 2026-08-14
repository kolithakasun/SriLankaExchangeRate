import { fetchHtmlProvider } from "./base.js";
import type { BankExchangeRateProvider } from "./types.js";

/** Seylan: server-rendered HTML table with Telegraphic Transfers columns. */
export const seylanProvider: BankExchangeRateProvider = {
  code: "SEYLAN",
  async fetchRates() {
    // Columns: name, code, notes buy/sell, TC buy/sell, TT buy/sell, import sell
    return fetchHtmlProvider({
      bankCode: "SEYLAN",
      parserTag: "seylan-html",
      fallbackTtColumns: { buy: 6, sell: 7 },
      preferFallback: true,
    });
  },
};
