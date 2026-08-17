import type { ProviderResult } from "../../../shared/types.js";

export interface BankExchangeRateProvider {
  code: string;
  fetchRates(): Promise<ProviderResult>;
}

export const PARSER_VERSION = "1.0.0";
