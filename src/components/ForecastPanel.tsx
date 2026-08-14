import type { ForecastResponse } from "@shared/types";
import { formatRate } from "@shared/utils/rates";

function prettyAction(action: "buy_forex" | "sell_forex"): string {
  return action === "buy_forex" ? "Buy foreign currency" : "Sell foreign currency";
}

export function ForecastPanel({
  currency,
  forecast,
  loading,
  error,
}: {
  currency: string;
  forecast: ForecastResponse | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Forecast assistant · {currency} / LKR
          </h3>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Free trend-based suggestion from collected daily closes ({forecast?.method ?? "trend_regression"})
          </p>
        </div>
        {forecast && (
          <p className="text-xs text-[var(--color-ink-muted)]">
            Bank {forecast.bank} · Data quality {forecast.dataQuality}
          </p>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">Computing forecast…</p>
      ) : error ? (
        <p className="mt-4 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
          {error}
        </p>
      ) : !forecast ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">No forecast available.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {forecast.advice.map((tip) => (
              <div key={tip.action} className="rounded-xl border border-[var(--color-line)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                  {prettyAction(tip.action)}
                </p>
                <p className="mt-1 text-base font-semibold">
                  {tip.recommendedDate ? `Suggested day: ${tip.recommendedDate}` : "Suggested day: not enough data yet"}
                </p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  Confidence: {tip.confidence}
                </p>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{tip.reason}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-line)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-bg-soft)] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Pred. Buying</th>
                  <th className="px-3 py-2">Pred. Selling</th>
                </tr>
              </thead>
              <tbody>
                {forecast.forecast.map((row) => (
                  <tr key={row.date} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="rate-num px-3 py-2 font-semibold">
                      {formatRate(row.predictedBuying, currency)}
                    </td>
                    <td className="rate-num px-3 py-2 font-semibold">
                      {formatRate(row.predictedSelling, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
