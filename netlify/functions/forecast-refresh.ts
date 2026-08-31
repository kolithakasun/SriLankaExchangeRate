import type { Handler } from "@netlify/functions";
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
 * Manual forecast update: re-collects every source, re-pulls the official CBSL
 * series, then returns the recomputed forecast. When provider=cursor, requires
 * a signed-in user and uses the global 2/day Cursor quota asynchronously.
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
  const results = await fetchAllBankRates();
  for (const r of results) {
    if (!r.success) {
      console.error(`Provider: ${r.bankCode} Error: ${r.error}`);
    }
  }
  const persisted = await persistProviderResults(results);

  const collection = {
    checked: persisted.checked,
    inserted: persisted.inserted,
    dailyCreated: persisted.dailyCreated,
    dailyUpdated: persisted.dailyUpdated,
    failed: results
      .filter((r) => !r.success)
      .map((r) => ({ bankCode: r.bankCode, error: r.error ?? null })),
  };

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
    const latest = await findLatestCompletedCursorNarration();
    const quota = await getCursorQuotaStatus();
    if (latest?.narration) {
      return json(200, {
        ok: true,
        collection,
        ...numericRest,
        narration: latest.narration,
        narrationSource: "cursor",
        narrationCached: true,
        cursorQuotaExhausted: true,
        cursorRun: {
          id: latest.id,
          status: latest.status,
          slot: latest.slot,
        },
        cursorQuota: quota,
        availableProviders: providers,
      });
    }
    return json(429, {
      error:
        "Cursor daily limit reached (2 generations per Colombo day). Try again after midnight Colombo time.",
      cursorQuota: quota,
      collection,
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
