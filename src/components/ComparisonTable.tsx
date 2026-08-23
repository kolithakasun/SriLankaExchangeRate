import type { BestRates, LatestRateView } from "@shared/types";
import { formatRate } from "@shared/utils/rates";
import { RateValue } from "./RateValue";
import { StatusDot } from "./BankStatus";

function RateRow({
  rate,
  best,
  highlightBest,
}: {
  rate: LatestRateView;
  best: BestRates;
  highlightBest: boolean;
}) {
  const isBestBuy =
    highlightBest &&
    best.bestBuying &&
    rate.bankCode === best.bestBuying.bankCode &&
    rate.ttBuying === best.bestBuying.rate;
  const isBestSell =
    highlightBest &&
    best.bestSelling &&
    rate.bankCode === best.bestSelling.bankCode &&
    rate.ttSelling === best.bestSelling.rate;

  return (
    <tr className="border-b border-[var(--color-line)] last:border-0">
      <td className="px-4 py-3 font-semibold">{rate.bankName}</td>
      <td className={`px-4 py-3 ${isBestBuy ? "bg-[var(--color-accent-soft)]" : ""}`}>
        <RateValue
          value={rate.ttBuying}
          currency={rate.currency}
          previous={rate.previousTtBuying}
          size="sm"
        />
      </td>
      <td className={`px-4 py-3 ${isBestSell ? "bg-[var(--color-accent-soft)]" : ""}`}>
        <RateValue
          value={rate.ttSelling}
          currency={rate.currency}
          previous={rate.previousTtSelling}
          size="sm"
        />
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-ink-muted)]">
        <span className="inline-flex items-center gap-2">
          <StatusDot status={rate.status} />
          {rate.status}
        </span>
      </td>
    </tr>
  );
}

export function ComparisonTable({
  rates,
  best,
  references = [],
}: {
  rates: LatestRateView[];
  best: BestRates;
  references?: LatestRateView[];
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
            {rates.map((r) => (
              <RateRow key={r.bankCode} rate={r} best={best} highlightBest />
            ))}
            {references.length > 0 && (
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-accent-soft)]/30">
                <td
                  colSpan={4}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--color-ink-muted)]"
                >
                  Official / market references
                </td>
              </tr>
            )}
            {references.map((r) => (
              <RateRow key={r.bankCode} rate={r} best={best} highlightBest={false} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {[...rates, ...references].map((r) => (
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
