import type { Handler } from "@netlify/functions";
import { fetchAllBankRates } from "./providers/index.js";
import { persistProviderResults, usingSupabase } from "./lib/store.js";
import { checkRefreshAllowed, json, wrap } from "./lib/http.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const allowed = checkRefreshAllowed(event);
  if (!allowed.ok) {
    return json(429, { error: allowed.reason });
  }

  console.log("Starting rate refresh…");
  const results = await fetchAllBankRates();

  for (const r of results) {
    if (r.success) {
      console.log(`Provider: ${r.bankCode} OK (${r.rates.length} currencies)`);
    } else {
      console.error(`Provider: ${r.bankCode} Error: ${r.error}`);
    }
  }

  const persisted = await persistProviderResults(results);

  return json(200, {
    ok: true,
    storage: usingSupabase() ? "supabase" : "local",
    checked: persisted.checked,
    inserted: persisted.inserted,
    results: results.map((r) => ({
      bankCode: r.bankCode,
      success: r.success,
      currencies: r.rates.map((x) => x.currency),
      error: r.error ?? null,
      retrievedAt: r.retrievedAt,
      sourceTimestamp: r.sourceTimestamp ?? null,
    })),
  });
});

export { handler };
