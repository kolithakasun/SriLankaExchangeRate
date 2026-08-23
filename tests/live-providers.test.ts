import { describe, expect, it } from "vitest";
import { isReferenceSource } from "../shared/config/banks";
import { fetchAllBankRates } from "../netlify/functions/providers/index";

const runLive = process.env.LIVE_PROVIDERS === "1";

describe.runIf(runLive)("live providers", () => {
  it(
    "fetches TT rates from enabled banks independently",
    async () => {
      const results = await fetchAllBankRates();
      const bankResults = results.filter((r) => !isReferenceSource(r.bankCode));
      expect(bankResults.length).toBeGreaterThanOrEqual(7);

      for (const r of results) {
        // eslint-disable-next-line no-console
        console.log(
          r.bankCode,
          r.success ? "OK" : "FAIL",
          r.error ?? "",
          r.rates.find((x) => x.currency === "USD"),
        );
      }

      const successes = bankResults.filter((r) => r.success);
      expect(successes.length).toBeGreaterThanOrEqual(3);

      for (const r of successes) {
        const usd = r.rates.find((x) => x.currency === "USD");
        expect(usd?.ttBuying).toBeTypeOf("number");
        expect(usd?.ttSelling).toBeTypeOf("number");
      }
    },
    90_000,
  );
});
