import type { BankCode, BankConfig, SourceKind } from "../types.js";

export const banks: BankConfig[] = [
  {
    code: "SEYLAN",
    name: "Seylan Bank",
    shortName: "Seylan",
    priority: 1,
    enabled: true,
    featured: true,
    kind: "bank",
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
    kind: "bank",
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
    kind: "bank",
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
    kind: "bank",
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
    kind: "bank",
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
    kind: "bank",
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
    kind: "bank",
    sourceUrl: "https://www.boc.lk/rates-tariff",
    provider: "boc",
  },
  {
    code: "CBSL",
    name: "Central Bank of Sri Lanka",
    shortName: "CBSL",
    priority: 90,
    enabled: true,
    featured: false,
    kind: "reference",
    sourceUrl:
      "https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/daily-buy-and-sell-exchange-rates",
    provider: "cbsl",
  },
  {
    code: "GOOGLE",
    name: "Google Finance",
    shortName: "Google",
    priority: 91,
    enabled: true,
    featured: false,
    kind: "reference",
    sourceUrl: "https://www.google.com/finance/quote/USD-LKR",
    provider: "google",
  },
];

export function sourceKind(bank: BankConfig | string): SourceKind {
  if (typeof bank === "string") {
    return getBankByCode(bank)?.kind ?? "bank";
  }
  return bank.kind ?? "bank";
}

export function isReferenceSource(code: string): boolean {
  return sourceKind(code) === "reference";
}

/** Licensed banks shown in comparison, history, and forecast bank pickers. */
export function getEnabledBanks(): BankConfig[] {
  return banks
    .filter((b) => b.enabled && sourceKind(b) === "bank")
    .sort((a, b) => a.priority - b.priority);
}

/** Banks plus CBSL/Google — used only by collectors. */
export function getEnabledSources(): BankConfig[] {
  return banks.filter((b) => b.enabled).sort((a, b) => a.priority - b.priority);
}

export function getReferenceSources(): BankConfig[] {
  return getEnabledSources().filter((b) => sourceKind(b) === "reference");
}

export function isKnownSource(code: string): boolean {
  return Boolean(getBankByCode(code));
}

export function isEnabledSource(code: string): boolean {
  return getEnabledSources().some((b) => b.code === code.toUpperCase());
}

export function isForecastableBank(code: string): boolean {
  return getEnabledBanks().some((b) => b.code === code.toUpperCase() as BankCode);
}

export function getBankByCode(code: string): BankConfig | undefined {
  return banks.find((b) => b.code === code.toUpperCase());
}

export function getFeaturedBanks(): BankConfig[] {
  return getEnabledBanks().filter((b) => b.featured);
}
