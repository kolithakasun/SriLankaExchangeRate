import type { BestRates, DayComparison } from "@shared/types";
import { formatRate } from "@shared/utils/rates";

export function BestRatesPanel({
  currency,
  best,
  day,
}: {
  currency: string;
  best: BestRates;
  day: DayComparison;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Best rates · {currency} / LKR
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Best TT Buying
              <span className="block font-normal">(you sell FX to the bank)</span>
            </p>
            <p className="mt-1 text-lg font-bold">
              {best.bestBuying
                ? `${best.bestBuying.bankName} — `
                : "—"}
              <span className="rate-num">
                {formatRate(best.bestBuying?.rate ?? null, currency)}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Best TT Selling
              <span className="block font-normal">(you buy FX from the bank)</span>
            </p>
            <p className="mt-1 text-lg font-bold">
              {best.bestSelling
                ? `${best.bestSelling.bankName} — `
                : "—"}
              <span className="rate-num">
                {formatRate(best.bestSelling?.rate ?? null, currency)}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Day comparison · {day.bankCode ?? "featured"}
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[var(--color-ink-muted)]">TT Buying</p>
            <p>
              Today{" "}
              <span className="rate-num font-semibold">
                {formatRate(day.todayBuying, currency)}
              </span>
            </p>
            <p>
              Yesterday{" "}
              <span className="rate-num font-semibold">
                {formatRate(day.yesterdayBuying, currency)}
              </span>
            </p>
            <p className="mt-1 font-semibold">
              Change{" "}
              <span className="rate-num">
                {day.buyingChange === null
                  ? "—"
                  : `${day.buyingChange > 0 ? "+" : ""}${day.buyingChange}`}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[var(--color-ink-muted)]">TT Selling</p>
            <p>
              Today{" "}
              <span className="rate-num font-semibold">
                {formatRate(day.todaySelling, currency)}
              </span>
            </p>
            <p>
              Yesterday{" "}
              <span className="rate-num font-semibold">
                {formatRate(day.yesterdaySelling, currency)}
              </span>
            </p>
            <p className="mt-1 font-semibold">
              Change{" "}
              <span className="rate-num">
                {day.sellingChange === null
                  ? "—"
                  : `${day.sellingChange > 0 ? "+" : ""}${day.sellingChange}`}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
