import type { Handler } from "@netlify/functions";
import { json, wrap } from "./lib/http.js";
import {
  buildForecastPayload,
  resolveForecastRequest,
} from "./lib/forecast-payload.js";
import { requireUser } from "./lib/auth.js";
import {
  findLatestCompletedCursorNarration,
  getCursorQuotaStatus,
} from "./lib/cursor-quota.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const resolved = resolveForecastRequest(event.queryStringParameters ?? {});
  if ("error" in resolved) {
    return json(400, { error: resolved.error });
  }

  // Cursor may appear in availableProviders for signed-in users, but this GET
  // never launches a Cursor run — that only happens via forecast-refresh.
  let includeCursorProvider = false;
  const authHeader =
    event.headers.authorization || event.headers.Authorization;
  if (authHeader) {
    const auth = await requireUser(event);
    if (!("error" in auth)) {
      includeCursorProvider = true;
    }
  }

  const wantsCursor = resolved.request.provider?.toLowerCase() === "cursor";
  // Strip cursor from the sync narrator path (no new Cursor spend on GET).
  const request = wantsCursor
    ? { ...resolved.request, provider: "auto" }
    : resolved.request;

  if (wantsCursor && includeCursorProvider) {
    const quota = await getCursorQuotaStatus();
    if (quota.remaining === 0) {
      const latest = await findLatestCompletedCursorNarration({
        bank: resolved.request.bank,
        currency: resolved.request.currency,
        range: resolved.request.range,
      });
      const payload = await buildForecastPayload(request, {
        includeCursorProvider: true,
        narrationOverride: latest?.narration
          ? {
              text: latest.narration,
              source: "cursor",
              cached: true,
            }
          : undefined,
      });
      return json(200, {
        ...payload,
        cursorQuotaExhausted: true,
        cursorQuota: quota,
        cursorRun: latest
          ? {
              id: latest.id,
              status: latest.status,
              slot: latest.slot,
              completedAt: latest.completedAt,
            }
          : undefined,
      });
    }
  }

  const payload = await buildForecastPayload(request, { includeCursorProvider });
  if (includeCursorProvider) {
    return json(200, {
      ...payload,
      cursorQuota: await getCursorQuotaStatus(),
    });
  }
  return json(200, payload);
});

export { handler };
