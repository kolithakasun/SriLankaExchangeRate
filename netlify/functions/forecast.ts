import type { Handler } from "@netlify/functions";
import { json, wrap } from "./lib/http.js";
import {
  buildForecastPayload,
  resolveForecastRequest,
} from "./lib/forecast-payload.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const resolved = resolveForecastRequest(event.queryStringParameters ?? {});
  if ("error" in resolved) {
    return json(400, { error: resolved.error });
  }

  return json(200, await buildForecastPayload(resolved.request));
});

export { handler };
