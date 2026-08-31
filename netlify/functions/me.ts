import type { Handler } from "@netlify/functions";
import { requireUser } from "./lib/auth.js";
import { getCursorQuotaStatus } from "./lib/cursor-quota.js";
import { isCursorConfigured } from "./lib/cursor-narration.js";
import { json, wrap } from "./lib/http.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const auth = await requireUser(event);
  if ("error" in auth) {
    return json(auth.statusCode, { error: auth.error });
  }

  const quota = await getCursorQuotaStatus();

  return json(200, {
    user: auth.user,
    cursor: {
      configured: isCursorConfigured(),
      quota,
    },
  });
});

export { handler };
