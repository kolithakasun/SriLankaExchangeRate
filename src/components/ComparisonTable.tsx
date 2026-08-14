import type { BestRates, LatestRateView } from "@shared/types";
import { formatRate } from "@shared/utils/rates";
import { RateValue } from "./RateValue";
import { StatusDot } from "./BankStatus";

export function ComparisonTable({
  rates,
  best,
}: {
  rates: LatestRateView[];
  best: BestRates;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="overflow-x-auto">
        <table className="hidden w-full min-w-[640px] text-left md:table">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-accent-soft)]/50 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Bank</th>
              <th className="px-4 py-3 font-semibold">TT Buying</th>
              <th className="px-4 py-3 font-semibold">TT Selling</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => {
              const isBestBuy =
                best.bestBuying &&
                r.bankCode === best.bestBuying.bankCode &&
                r.ttBuying === best.bestBuying.rate;
              const isBestSell =
                best.bestSelling &&
                r.bankCode === best.bestSelling.bankCode &&
                r.ttSelling === best.bestSelling.rate;
              return (
                <tr key={r.bankCode} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-3 font-semibold">{r.bankName}</td>
                  <td className={`px-4 py-3 ${isBestBuy ? "bg-[var(--color-accent-soft)]" : ""}`}>
                    <RateValue
                      value={r.ttBuying}
                      currency={r.currency}
                      previous={r.previousTtBuying}
                      size="sm"
                    />
                  </td>
                  <td className={`px-4 py-3 ${isBestSell ? "bg-[var(--color-accent-soft)]" : ""}`}>
                    <RateValue
                      value={r.ttSelling}
                      currency={r.currency}
                      previous={r.previousTtSelling}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-ink-muted)]">
                    <span className="inline-flex items-center gap-2">
                      <StatusDot status={r.status} />
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {rates.map((r) => (
          <div
            key={r.bankCode}
            className="rounded-xl border border-[var(--color-line)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{r.shortName}</p>
              <StatusDot status={r.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[var(--color-ink-muted)]">Buying</p>
                <p className="rate-num font-semibold">
                  {formatRate(r.ttBuying, r.currency)}
                </p>
              </div>
              <div>
                <p className="text-[var(--color-ink-muted)]">Selling</p>
                <p className="rate-num font-semibold">
                  {formatRate(r.ttSelling, r.currency)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
