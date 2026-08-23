import type { Handler } from "@netlify/functions";
import { banks, getEnabledBanks } from "../../shared/config/banks.js";
import { json, wrap } from "./lib/http.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }
  const all = event.queryStringParameters?.all === "1";
  return json(200, {
    banks: (all ? banks : getEnabledBanks()).map((b) => ({
      code: b.code,
      name: b.name,
      shortName: b.shortName,
      priority: b.priority,
      enabled: b.enabled,
      featured: b.featured,
      kind: b.kind ?? "bank",
      sourceUrl: b.sourceUrl,
      provider: b.provider,
    })),
  });
});

export { handler };
