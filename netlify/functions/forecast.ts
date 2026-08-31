import type { Handler } from "@netlify/functions";
import { json, wrap } from "./lib/http.js";
import {
  buildForecastPayload,
  resolveForecastRequest,
} from "./lib/forecast-payload.js";
import { requireUser } from "./lib/auth.js";

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

  // Strip cursor from the sync narrator path.
  const request =
    resolved.request.provider?.toLowerCase() === "cursor"
      ? { ...resolved.request, provider: "auto" }
      : resolved.request;

  return json(
    200,
    await buildForecastPayload(request, { includeCursorProvider }),
  );
});

export { handler };
