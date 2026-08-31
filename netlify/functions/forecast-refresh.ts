import type { Handler } from "@netlify/functions";
import { fetchAllBankRates } from "./providers/index.js";
import { persistProviderResults } from "./lib/store.js";
import { checkRefreshAllowed, json, wrap } from "./lib/http.js";
import {
  buildForecastPayload,
  resolveForecastRequest,
} from "./lib/forecast-payload.js";

/**
 * Manual forecast update: re-collects every source, re-pulls the official CBSL
 * series, then returns the recomputed forecast so the caller needs no second
 * request. Rate-limited by the same cooldown as /api/refresh.
 */
const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const resolved = resolveForecastRequest(event.queryStringParameters ?? {});
  if ("error" in resolved) {
    return json(400, { error: resolved.error });
  }

  const allowed = checkRefreshAllowed(event);
  if (!allowed.ok) {
    return json(allowed.statusCode ?? 429, { error: allowed.reason });
  }

  console.log("Starting manual forecast refresh…");
  const results = await fetchAllBankRates();
  for (const r of results) {
    if (!r.success) {
      console.error(`Provider: ${r.bankCode} Error: ${r.error}`);
    }
  }
  const persisted = await persistProviderResults(results);

  const payload = await buildForecastPayload(resolved.request, {
    forceLiveCbsl: true,
  });

  return json(200, {
    ok: true,
    collection: {
      checked: persisted.checked,
      inserted: persisted.inserted,
      dailyCreated: persisted.dailyCreated,
      dailyUpdated: persisted.dailyUpdated,
      failed: results
        .filter((r) => !r.success)
        .map((r) => ({ bankCode: r.bankCode, error: r.error ?? null })),
    },
    ...payload,
  });
});

export { handler };
