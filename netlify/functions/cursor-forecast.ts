import type { Handler } from "@netlify/functions";
import { requireUser } from "./lib/auth.js";
import { getAvailableProviders } from "./lib/ai.js";
import { json, wrap } from "./lib/http.js";
import {
  getCursorQuotaStatus,
  getCursorRunById,
} from "./lib/cursor-quota.js";
import {
  isCursorConfigured,
  reconcileCursorRun,
} from "./lib/cursor-narration.js";

/**
 * Authenticated Cursor run status + global quota.
 * GET /api/cursor-forecast?runId=<uuid>
 * GET /api/cursor-forecast  (quota only)
 */
const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const auth = await requireUser(event);
  if ("error" in auth) {
    return json(auth.statusCode, { error: auth.error });
  }

  const runId = event.queryStringParameters?.runId?.trim();
  const quota = await getCursorQuotaStatus();
  const providers = getAvailableProviders({ includeCursor: true });

  if (!runId) {
    return json(200, {
      configured: isCursorConfigured(),
      cursorQuota: quota,
      availableProviders: providers,
    });
  }

  let run = await getCursorRunById(runId);
  if (!run) {
    return json(404, { error: "Cursor run not found", cursorQuota: quota });
  }

  if (run.status === "pending" || run.status === "reserved") {
    run = await reconcileCursorRun(run);
  }

  return json(200, {
    configured: isCursorConfigured(),
    cursorQuota: await getCursorQuotaStatus(),
    availableProviders: providers,
    cursorRun: {
      id: run.id,
      status: run.status,
      slot: run.slot,
      agentId: run.agentId,
      runId: run.runId,
      narration: run.narration,
      error: run.error,
      completedAt: run.completedAt,
    },
  });
});

export { handler };
