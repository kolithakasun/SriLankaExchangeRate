import type { Config, Handler } from "@netlify/functions";
import { fetchAllBankRates } from "./providers/index.js";
import { persistProviderResults } from "./lib/store.js";

/**
 * Scheduled collection of bank TT rates.
 * Schedule is also declared in netlify.toml.
 */
export const handler: Handler = async () => {
  console.log("Scheduled refresh started");
  const results = await fetchAllBankRates();
  for (const r of results) {
    if (!r.success) {
      console.error(`Provider: ${r.bankCode} Error: ${r.error}`);
    } else {
      console.log(`Provider: ${r.bankCode} OK`);
    }
  }
  const persisted = await persistProviderResults(results);
  console.log(
    `Scheduled refresh done. checked=${persisted.checked} inserted=${persisted.inserted}`,
  );
  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      checked: persisted.checked,
      inserted: persisted.inserted,
    }),
  };
};

export const config: Config = {
  schedule: "*/30 * * * *",
};
