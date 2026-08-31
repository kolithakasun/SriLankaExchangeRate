import type { Config, Handler } from "@netlify/functions";
import { fetchAllBankRates } from "./providers/index.js";
import { persistProviderResults } from "./lib/store.js";
import { requireUser } from "./lib/auth.js";
import { getAvailableProviders } from "./lib/ai.js";
import { checkRefreshAllowed, json, wrap } from "./lib/http.js";
import {
  buildForecastNumericPayload,
  buildForecastPayload,
  resolveForecastRequest,
} from "./lib/forecast-payload.js";
import {
  claimCursorQuotaSlot,
  findCompletedCursorNarration,
  findLatestCompletedCursorNarration,
  getCursorQuotaStatus,
  hashForecastInput,
} from "./lib/cursor-quota.js";
import {
  isCursorConfigured,
  launchCursorNarration,
} from "./lib/cursor-narration.js";

/**
 * Manual forecast update. Non-Cursor path re-scrapes all banks. Cursor path
 * uses stored daily rates + live CBSL (and kicks a background scrape) so the
 * request stays under the function timeout and can launch the cloud agent.
 */
const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const resolved = resolveForecastRequest(event.queryStringParameters ?? {});
  if ("error" in resolved) {
    return json(400, { error: resolved.error });
  }

  const wantsCursor = resolved.request.provider?.toLowerCase() === "cursor";
  let userId: string | null = null;

  if (wantsCursor) {
    const auth = await requireUser(event);
    if ("error" in auth) {
      return json(auth.statusCode, { error: auth.error });
    }
    if (!isCursorConfigured()) {
      return json(503, { error: "Cursor is not configured on the server" });
    }
    userId = auth.user.id;
  }

  const allowed = checkRefreshAllowed(event);
  if (!allowed.ok) {
    return json(allowed.statusCode ?? 429, { error: allowed.reason });
  }

  console.log(
    wantsCursor
      ? "Starting Cursor forecast refresh…"
      : "Starting manual forecast refresh…",
  );

  let collection: {
    checked: number;
    inserted: number;
    dailyCreated?: number;
    dailyUpdated?: number;
    failed: Array<{ bankCode: string; error: string | null }>;
  };

  if (wantsCursor) {
    // Background scrape — do not block Cursor launch on every bank HTML fetch.
    void fetchAllBankRates()
      .then((results) => persistProviderResults(results))
      .catch((err) => console.error("Background rate refresh failed", err));
    collection = {
      checked: 0,
      inserted: 0,
      failed: [],
    };
  } else {
    const results = await fetchAllBankRates();
    for (const r of results) {
      if (!r.success) {
        console.error(`Provider: ${r.bankCode} Error: ${r.error}`);
      }
    }
    const persisted = await persistProviderResults(results);
    collection = {
      checked: persisted.checked,
      inserted: persisted.inserted,
      dailyCreated: persisted.dailyCreated,
      dailyUpdated: persisted.dailyUpdated,
      failed: results
        .filter((r) => !r.success)
        .map((r) => ({ bankCode: r.bankCode, error: r.error ?? null })),
    };
  }

  if (!wantsCursor || !userId) {
    const payload = await buildForecastPayload(resolved.request, {
      forceLiveCbsl: true,
      includeCursorProvider: false,
    });
    return json(200, { ok: true, collection, ...payload });
  }

  const numeric = await buildForecastNumericPayload(resolved.request, {
    forceLiveCbsl: true,
  });
  const providers = getAvailableProviders({ includeCursor: true });
  const inputHash = hashForecastInput({
    bank: numeric.bank,
    currency: numeric.currency,
    range: numeric.range,
    forecast: numeric.forecast,
  });
  const { rangeLabel: _rangeLabel, ...numericRest } = numeric;

  const exact = await findCompletedCursorNarration(inputHash);
  if (exact?.narration) {
    return json(200, {
      ok: true,
      collection,
      ...numericRest,
      narration: exact.narration,
      narrationSource: "cursor",
      narrationCached: true,
      cursorRun: { id: exact.id, status: exact.status, slot: exact.slot },
      cursorQuota: await getCursorQuotaStatus(),
      availableProviders: providers,
    });
  }

  const claimed = await claimCursorQuotaSlot({
    inputHash,
    bank: numeric.bank,
    currency: numeric.currency,
    range: numeric.range,
    requestedBy: userId,
  });

  if ("exhausted" in claimed) {
    const latest = await findLatestCompletedCursorNarration({
      bank: numeric.bank,
      currency: numeric.currency,
      range: numeric.range,
    });
    const quota = await getCursorQuotaStatus();
    // Always return refreshed numbers; reuse the last Cursor summary when available.
    return json(200, {
      ok: true,
      collection,
      ...numericRest,
      narration:
        latest?.narration ??
        "Cursor daily limit reached (2 generations per Colombo day). No prior Cursor summary is saved yet — try again after midnight Colombo time.",
      narrationSource: latest?.narration ? "cursor" : "template",
      narrationCached: Boolean(latest?.narration),
      cursorQuotaExhausted: true,
      cursorRun: latest
        ? {
            id: latest.id,
            status: latest.status,
            slot: latest.slot,
            completedAt: latest.completedAt,
          }
        : undefined,
      cursorQuota: quota,
      availableProviders: providers,
    });
  }

  const launched = await launchCursorNarration({
    reservedRunId: claimed.run.id,
    forecast: numeric.forecast,
    bank: numeric.bank,
    currency: numeric.currency,
    rangeLabel: numeric.rangeLabel,
  });

  const quota = await getCursorQuotaStatus();

  if ("error" in launched) {
    return json(502, {
      error: `Cursor launch failed: ${launched.error}`,
      collection,
      cursorQuota: quota,
      availableProviders: providers,
    });
  }

  return json(202, {
    ok: true,
    collection,
    ...numericRest,
    narration: "Cursor is generating a summary…",
    narrationSource: "cursor",
    narrationCached: false,
    cursorPending: true,
    cursorRun: {
      id: claimed.run.id,
      status: "pending",
      slot: claimed.run.slot,
      agentId: launched.agentId,
      runId: launched.runId,
    },
    cursorQuota: quota,
    availableProviders: providers,
  });
});

export { handler };

/** Local + production budget for CBSL fill + Cursor launch (scrape is background). */
export const config: Config = {
  timeout: 60,
};
