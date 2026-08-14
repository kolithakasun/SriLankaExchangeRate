import type { BankConfig } from "../types.js";

export const banks: BankConfig[] = [
  {
    code: "SEYLAN",
    name: "Seylan Bank",
    shortName: "Seylan",
    priority: 1,
    enabled: true,
    featured: true,
    sourceUrl: "https://www.seylan.lk/exchange-rates",
    provider: "seylan",
  },
  {
    code: "HNB",
    name: "Hatton National Bank",
    shortName: "HNB",
    priority: 2,
    enabled: true,
    featured: true,
    sourceUrl: "https://www.hnb.lk/exchange-rates",
    provider: "hnb",
  },
  {
    code: "COMMERCIAL",
    name: "Commercial Bank",
    shortName: "Commercial",
    priority: 3,
    enabled: true,
    featured: true,
    sourceUrl: "https://www.combank.lk/rates-tariff#exchange-rates",
    provider: "commercial",
  },
  {
    code: "SAMPATH",
    name: "Sampath Bank",
    shortName: "Sampath",
    priority: 4,
    enabled: true,
    featured: false,
    sourceUrl:
      "https://www.sampath.lk/rates-and-charges?activeTab=exchange-rates",
    provider: "sampath",
  },
  {
    code: "NDB",
    name: "NDB Bank",
    shortName: "NDB",
    priority: 5,
    enabled: true,
    featured: false,
    sourceUrl: "https://www.ndbbank.com/rates/exchange-rates",
    provider: "ndb",
  },
  {
    code: "PEOPLES",
    name: "People's Bank",
    shortName: "People's",
    priority: 6,
    enabled: true,
    featured: false,
    sourceUrl: "https://www.peoplesbank.lk/exchange-rates/",
    provider: "peoples",
  },
  {
    code: "BOC",
    name: "Bank of Ceylon",
    shortName: "BOC",
    priority: 7,
    enabled: true,
    featured: false,
    sourceUrl: "https://www.boc.lk/rates-tariff",
    provider: "boc",
  },
];

export function getEnabledBanks(): BankConfig[] {
  return banks.filter((b) => b.enabled).sort((a, b) => a.priority - b.priority);
}

export function getBankByCode(code: string): BankConfig | undefined {
  return banks.find((b) => b.code === code.toUpperCase());
}

export function getFeaturedBanks(): BankConfig[] {
  return getEnabledBanks().filter((b) => b.featured);
}
