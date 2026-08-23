import type { Handler } from "@netlify/functions";
import { getDailyHistory, getLatestRates, usingSupabase } from "./lib/store.js";
import { json, wrap } from "./lib/http.js";
import { overlayLiveReferenceRates } from "./lib/live-references.js";
import { getEnabledBanks } from "../../shared/config/banks.js";
import { DEFAULT_CURRENCY } from "../../shared/config/currencies.js";
import type { BestRates, DayComparison, LatestRateView } from "../../shared/types.js";

function computeBest(rates: LatestRateView[], currency: string): BestRates {
  let bestBuying: BestRates["bestBuying"] = null;
  let bestSelling: BestRates["bestSelling"] = null;

  for (const r of rates.filter((x) => x.currency === currency)) {
    if (r.ttBuying !== null) {
      if (!bestBuying || r.ttBuying > bestBuying.rate) {
        bestBuying = {
          bankCode: r.bankCode,
          bankName: r.bankName,
          rate: r.ttBuying,
        };
      }
    }
    if (r.ttSelling !== null) {
      if (!bestSelling || r.ttSelling < bestSelling.rate) {
        bestSelling = {
          bankCode: r.bankCode,
          bankName: r.bankName,
          rate: r.ttSelling,
        };
      }
    }
  }

  return { currency, bestBuying, bestSelling };
}

async function dayComparison(
  currency: string,
  bankCode?: string,
): Promise<DayComparison> {
  const bank = bankCode ?? getEnabledBanks()[0]?.code ?? "SEYLAN";

  // Compare the two most recent days that actually have data, so a missed day
  // (holiday, outage) still yields a meaningful change instead of a blank.
  const { daily } = await getDailyHistory({ bank, currency, days: 30 });
  const latest = daily[daily.length - 1] ?? null;
  const previous = daily.length > 1 ? daily[daily.length - 2] : null;

  const todayBuying = latest?.ttBuying ?? null;
  const yesterdayBuying = previous?.ttBuying ?? null;
  const todaySelling = latest?.ttSelling ?? null;
  const yesterdaySelling = previous?.ttSelling ?? null;

  return {
    currency,
    bankCode: bank,
    todayDate: latest?.date ?? null,
    previousDate: previous?.date ?? null,
    todayBuying,
    yesterdayBuying,
    buyingChange:
      todayBuying !== null && yesterdayBuying !== null
        ? Number((todayBuying - yesterdayBuying).toFixed(4))
        : null,
    todaySelling,
    yesterdaySelling,
    sellingChange:
      todaySelling !== null && yesterdaySelling !== null
        ? Number((todaySelling - yesterdaySelling).toFixed(4))
        : null,
  };
}

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters ?? {};
  const bank = params.bank?.toUpperCase();
  const currency = params.currency?.toUpperCase() ?? DEFAULT_CURRENCY;

  if (bank && !getEnabledBanks().some((b) => b.code === bank)) {
    return json(400, { error: "Unknown bank" });
  }

  const [rates, storedReferences] = await Promise.all([
    getLatestRates({
      bank,
      currency: params.currency ? currency : undefined,
    }),
    getLatestRates({
      currency: params.currency ? currency : undefined,
      kind: "reference",
    }),
  ]);

  const forCurrency = rates.filter((r) => r.currency === currency);
  const references = await overlayLiveReferenceRates(
    storedReferences.filter((r) => r.currency === currency),
    currency,
  );
  const best = computeBest(forCurrency, currency);
  const comparison = await dayComparison(currency, bank);

  const lastChecked = [...forCurrency, ...references]
    .map((r) => r.lastCheckedAt || r.retrievedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return json(200, {
    currency,
    bank: bank ?? null,
    storage: usingSupabase() ? "supabase" : "local",
    lastCheckedAt: lastChecked ?? null,
    rates: params.currency ? forCurrency : rates,
    references,
    comparison: forCurrency,
    best,
    dayComparison: comparison,
    banks: getEnabledBanks().map((b) => ({
      code: b.code,
      name: b.name,
      shortName: b.shortName,
      featured: b.featured,
      priority: b.priority,
      sourceUrl: b.sourceUrl,
    })),
  });
});

export { handler };
