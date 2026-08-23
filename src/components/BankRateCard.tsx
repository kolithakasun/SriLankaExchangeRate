import type { LatestRateView } from "@shared/types";
import { BankStatusLine } from "./BankStatus";
import { RateValue } from "./RateValue";

export function BankRateCard({
  rate,
  highlight,
}: {
  rate: LatestRateView;
  highlight?: "buying" | "selling" | null;
}) {
  return (
    <article className="@container rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-[0_1px_0_rgba(16,35,28,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{rate.bankName}</h3>
          <p className="text-xs text-[var(--color-ink-muted)]">{rate.currency} / LKR</p>
        </div>
        {highlight === "buying" && (
          <span className="rounded-md bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]">
            Best buying
          </span>
        )}
        {highlight === "selling" && (
          <span className="rounded-md bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]">
            Best selling
          </span>
        )}
      </div>

      {rate.bankCode === "GOOGLE" ? (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
            Mid-market
          </p>
          <RateValue
            value={rate.ttBuying ?? rate.ttSelling}
            currency={rate.currency}
            previous={rate.previousTtBuying ?? rate.previousTtSelling}
            size="lg"
          />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
              TT Buying
            </p>
            <RateValue
              value={rate.ttBuying}
              currency={rate.currency}
              previous={rate.previousTtBuying}
              size="lg"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
              TT Selling
            </p>
            <RateValue
              value={rate.ttSelling}
              currency={rate.currency}
              previous={rate.previousTtSelling}
              size="lg"
            />
          </div>
        </div>
      )}

      <BankStatusLine rate={rate} />
    </article>
  );
}
