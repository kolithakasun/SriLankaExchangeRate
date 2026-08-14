import type { Handler } from "@netlify/functions";
import { getLatestRates, usingSupabase } from "./lib/store.js";
import { json, wrap } from "./lib/http.js";
import { getEnabledBanks } from "../../shared/config/banks.js";
import type { BestRates, DayComparison, LatestRateView } from "../../shared/types.js";
import { getHistory } from "./lib/store.js";
import { colomboDateKey } from "../../shared/utils/time.js";

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
  const today = colomboDateKey();
  const yesterdayDate = new Date(`${today}T12:00:00+05:30`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = colomboDateKey(yesterdayDate);

  const bank = bankCode ?? getEnabledBanks()[0]?.code ?? "SEYLAN";
  const [todayRows, yesterdayRows] = await Promise.all([
    getHistory({ bank, currency, date: today }),
    getHistory({ bank, currency, date: yesterday }),
  ]);

  const todayLatest = todayRows[todayRows.length - 1];
  const yesterdayLatest = yesterdayRows[yesterdayRows.length - 1];

  const todayBuying = todayLatest?.ttBuying ?? null;
  const yesterdayBuying = yesterdayLatest?.ttBuying ?? null;
  const todaySelling = todayLatest?.ttSelling ?? null;
  const yesterdaySelling = yesterdayLatest?.ttSelling ?? null;

  return {
    currency,
    bankCode: bank,
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
  const currency = params.currency?.toUpperCase() ?? "USD";

  if (bank && !getEnabledBanks().some((b) => b.code === bank)) {
    return json(400, { error: "Unknown bank" });
  }

  const rates = await getLatestRates({
    bank,
    currency: params.currency ? currency : undefined,
  });

  const forCurrency = rates.filter((r) => r.currency === currency);
  const best = computeBest(forCurrency, currency);
  const comparison = await dayComparison(currency, bank);

  const lastChecked = forCurrency
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
