import type { Handler } from "@netlify/functions";
import { currencies, getEnabledCurrencies } from "../../shared/config/currencies.js";
import { json, wrap } from "./lib/http.js";

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }
  const all = event.queryStringParameters?.all === "1";
  return json(200, {
    currencies: all ? currencies : getEnabledCurrencies(),
  });
});

export { handler };
