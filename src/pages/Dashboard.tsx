import { useState } from "react";
import { relativeTime, toColombo } from "@shared/utils/time";
import { DEFAULT_CURRENCY } from "@shared/config/currencies";
import { useRates } from "../hooks/useRates";
import { CurrencySelector } from "../components/CurrencySelector";
import { BankRateCard } from "../components/BankRateCard";
import { ComparisonTable } from "../components/ComparisonTable";
import { BestRatesPanel } from "../components/BestRatesPanel";
import { HistorySection } from "../components/HistorySection";
import { ForecastPanel } from "../components/ForecastPanel";
import { ThemeToggle } from "../components/ThemeToggle";

export default function Dashboard() {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const { data, loading, refreshing, error, refresh } = useRates(currency);

  const featured = data?.rates.filter((r) => r.featured) ?? [];
  const others = data?.rates.filter((r) => !r.featured) ?? [];

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Sri Lanka Exchange Rates
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Latest TT Exchange Rates
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-muted)]">
            Updated continuously from bank sources. Telegraphic Transfer buying and
            selling rates for major Sri Lankan banks.
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {data?.lastCheckedAt
              ? `Last checked ${relativeTime(data.lastCheckedAt)} · ${toColombo(data.lastCheckedAt)}`
              : loading
                ? "Loading…"
                : "No rates stored yet — refresh to collect"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh Rates"}
          </button>
        </div>
      </header>

      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-[var(--color-ink-muted)]">Currency</p>
        <CurrencySelector value={currency} onChange={setCurrency} />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[var(--color-warn)]/30 bg-[var(--color-warn-soft)] px-4 py-3 text-sm text-[var(--color-warn)]">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="text-[var(--color-ink-muted)]">Loading rates…</p>
      ) : (
        <>
          {data && (
            <div className="mb-8">
              <BestRatesPanel
                currency={currency}
                best={data.best}
                day={data.dayComparison}
              />
            </div>
          )}

          <section className="mb-10">
            <div className="mb-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Featured Banks</h2>
              <p className="text-sm text-[var(--color-ink-muted)]">
                Seylan · HNB · Commercial Bank
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {featured.map((rate) => (
                <BankRateCard
                  key={rate.bankCode}
                  rate={rate}
                  highlight={
                    data?.best.bestBuying?.bankCode === rate.bankCode
                      ? "buying"
                      : data?.best.bestSelling?.bankCode === rate.bankCode
                        ? "selling"
                        : null
                  }
                />
              ))}
            </div>
          </section>

          <section className="mb-10">
            <div className="mb-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Other Banks</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((rate) => (
                <BankRateCard key={rate.bankCode} rate={rate} />
              ))}
            </div>
          </section>

          {data?.references && data.references.length > 0 && (
            <section className="mb-10">
              <div className="mb-4">
                <h2 className="text-2xl font-extrabold tracking-tight">
                  CBSL & Google
                </h2>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Official 9:30 a.m. TT average and Google Finance mid — not used for
                  best-bank highlights
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {data.references.map((rate) => (
                  <BankRateCard key={rate.bankCode} rate={rate} />
                ))}
              </div>
            </section>
          )}

          <div className="mb-12">
            <ForecastPanel defaultCurrency={currency} />
          </div>

          <section className="mb-12">
            <div className="mb-4">
              <h2 className="text-2xl font-extrabold tracking-tight">
                Compare · {currency} / LKR
              </h2>
              <p className="text-sm text-[var(--color-ink-muted)]">
                Highest buying and lowest selling rates are highlighted
              </p>
            </div>
            {data && (
              <ComparisonTable
                rates={data.rates}
                best={data.best}
                references={data.references}
              />
            )}
          </section>

          <HistorySection defaultCurrency={currency} />

          <footer className="mt-12 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink-muted)]">
            <p>
              Rates are collected from publicly published bank pages/APIs and may
              change during the day. Indicative only — confirm with your bank before
              transacting.
            </p>
            <p className="mt-2">
              Storage: {data?.storage ?? "—"} · TT = Telegraphic Transfer
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
