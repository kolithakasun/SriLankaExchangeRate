import { getEnabledSources } from "../../../shared/config/banks.js";
import type { ProviderResult } from "../../../shared/types.js";
import type { BankExchangeRateProvider } from "./types.js";
import { seylanProvider } from "./seylan.js";
import { hnbProvider } from "./hnb.js";
import { commercialProvider } from "./commercial.js";
import { sampathProvider } from "./sampath.js";
import { ndbProvider } from "./ndb.js";
import { peoplesProvider } from "./peoples.js";
import { bocProvider } from "./boc.js";
import { cbslProvider } from "./cbsl.js";
import { googleProvider } from "./google.js";

const providers: Record<string, BankExchangeRateProvider> = {
  seylan: seylanProvider,
  hnb: hnbProvider,
  commercial: commercialProvider,
  sampath: sampathProvider,
  ndb: ndbProvider,
  peoples: peoplesProvider,
  boc: bocProvider,
  cbsl: cbslProvider,
  google: googleProvider,
};

export function getProvider(providerKey: string): BankExchangeRateProvider | undefined {
  return providers[providerKey];
}

export async function fetchAllBankRates(): Promise<ProviderResult[]> {
  const enabled = getEnabledSources();
  const tasks = enabled.map(async (bank) => {
    const provider = getProvider(bank.provider);
    if (!provider) {
      return {
        bankCode: bank.code,
        success: false,
        rates: [],
        error: `No provider registered for ${bank.provider}`,
        retrievedAt: new Date().toISOString(),
      } satisfies ProviderResult;
    }
    try {
      return await provider.fetchRates();
    } catch (err) {
      return {
        bankCode: bank.code,
        success: false,
        rates: [],
        error: err instanceof Error ? err.message : String(err),
        retrievedAt: new Date().toISOString(),
      } satisfies ProviderResult;
    }
  });

  return Promise.all(tasks);
}

export { providers };
