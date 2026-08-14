import type { CurrencyConfig } from "../types.js";

/**
 * Add a currency by appending an entry here.
 * Providers will return the rate if the bank publishes it.
 */
export const currencies: CurrencyConfig[] = [
  {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
    enabled: true,
    decimals: 2,
  },
  {
    code: "USD",
    name: "United States Dollar",
    symbol: "$",
    enabled: true,
    decimals: 2,
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    enabled: true,
    decimals: 2,
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
    enabled: true,
    decimals: 4,
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    enabled: true,
    decimals: 2,
  },
];

/** Default currency shown on the dashboard and API when none is specified. */
export const DEFAULT_CURRENCY = "AUD";

export const supportedCurrencyCodes = currencies
  .filter((c) => c.enabled)
  .map((c) => c.code);

export function getEnabledCurrencies(): CurrencyConfig[] {
  return currencies.filter((c) => c.enabled);
}

export function getCurrency(code: string): CurrencyConfig | undefined {
  return currencies.find((c) => c.code === code.toUpperCase());
}
