import { describe, expect, it } from "vitest";
import { isReferenceSource, sourceKind } from "../shared/config/banks";
import { fetchAllBankRates } from "../netlify/functions/providers/index";

const runLive = process.env.LIVE_PROVIDERS === "1";

describe.runIf(runLive)("live providers", () => {
  it(
    "fetches TT rates from enabled banks independently",
    async () => {
      const results = await fetchAllBankRates();
      const bankResults = results.filter(
        (r) => sourceKind(r.bankCode) === "bank",
      );
      const p2pResults = results.filter((r) => sourceKind(r.bankCode) === "p2p");
      expect(bankResults.length).toBeGreaterThanOrEqual(7);

      for (const r of results) {
        // eslint-disable-next-line no-console
        console.log(
          r.bankCode,
          r.success ? "OK" : "FAIL",
          r.error ?? "",
          r.rates.find((x) => x.currency === "USD") ??
            r.rates.find((x) => x.currency === "USDT"),
        );
      }

      const successes = bankResults.filter((r) => r.success);
      expect(successes.length).toBeGreaterThanOrEqual(3);

      for (const r of successes) {
        const usd = r.rates.find((x) => x.currency === "USD");
        expect(usd?.ttBuying).toBeTypeOf("number");
        expect(usd?.ttSelling).toBeTypeOf("number");
      }

      const p2pOk = p2pResults.filter((r) => r.success);
      expect(p2pOk.length).toBeGreaterThanOrEqual(1);
      for (const r of p2pOk) {
        const usdt = r.rates.find((x) => x.currency === "USDT");
        expect(usdt?.ttBuying ?? usdt?.ttSelling).toBeTypeOf("number");
      }

      // References still present in the full run.
      expect(results.some((r) => isReferenceSource(r.bankCode))).toBe(true);
    },
    90_000,
  );
});
