import { latestCbslRates } from "../../../shared/utils/cbsl.js";
import { nowIso } from "../../../shared/utils/time.js";
import type { LatestRateView } from "../../../shared/types.js";
import { fetchCbslTtRows } from "../providers/cbsl.js";
import { fetchGoogleMid } from "../providers/google.js";

/** Prefer a live CBSL/Google quote when the stored snapshot is missing. */
export async function overlayLiveReferenceRates(
  views: LatestRateView[],
  currency: string,
): Promise<LatestRateView[]> {
  const retrievedAt = nowIso();

  return Promise.all(
    views.map(async (view) => {
      if (view.bankCode === "CBSL" && view.ttBuying === null && view.ttSelling === null) {
        try {
          const rows = await fetchCbslTtRows({ days: 7, currencies: [currency] });
          const latest = latestCbslRates(rows, retrievedAt, "cbsl-tt@live").find(
            (rate) => rate.currency === currency,
          );
          if (!latest) return view;
          return {
            ...view,
            ttBuying: latest.ttBuying,
            ttSelling: latest.ttSelling,
            sourceTimestamp: latest.sourceTimestamp ?? null,
            retrievedAt,
            lastCheckedAt: retrievedAt,
            lastSuccessAt: retrievedAt,
            lastError: null,
            status: "ok",
          };
        } catch (err) {
          return {
            ...view,
            lastError: err instanceof Error ? err.message : String(err),
            status: view.status === "ok" ? "stale" : "error",
          };
        }
      }

      if (view.bankCode === "GOOGLE" && view.ttBuying === null && view.ttSelling === null) {
        try {
          const mid = await fetchGoogleMid(currency);
          if (mid === null) return view;
          return {
            ...view,
            ttBuying: mid,
            ttSelling: mid,
            retrievedAt,
            lastCheckedAt: retrievedAt,
            lastSuccessAt: retrievedAt,
            lastError: null,
            status: "ok",
          };
        } catch (err) {
          return {
            ...view,
            lastError: err instanceof Error ? err.message : String(err),
            status: view.status === "ok" ? "stale" : "error",
          };
        }
      }

      return view;
    }),
  );
}
