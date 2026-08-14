import { useEffect, useState } from "react";
import { getEnabledBanks } from "@shared/config/banks";
import { getEnabledCurrencies } from "@shared/config/currencies";
import { formatRate } from "@shared/utils/rates";
import { weekdayName } from "@shared/utils/forecast";
import { fetchForecast, type ForecastResponse } from "../services/api";

type ProviderOption = "auto" | "gemini" | "groq";

const PROVIDER_LABELS: Record<ProviderOption, string> = {
  auto: "Auto (best available)",
  gemini: "Gemini",
  groq: "Groq",
};

export function ForecastPanel({ defaultCurrency }: { defaultCurrency: string }) {
  const banks = getEnabledBanks();
  const currencies = getEnabledCurrencies();
  const [bank, setBank] = useState<string>(banks[0]?.code ?? "SEYLAN");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [provider, setProvider] = useState<ProviderOption>("auto");
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchForecast({ bank, currency, provider });
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bank, currency, provider]);

  const availableProviders = data?.availableProviders ?? [];

  const forecast = data?.forecast;

  return (
    <section id="forecast" className="scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Forecast</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Trend and best-day-of-week signals from collected history
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--color-ink-muted)]">Bank</span>
          <select
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
          >
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--color-ink-muted)]">Currency</span>
          <select
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--color-ink-muted)]">AI model</span>
          <select
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderOption)}
          >
            {(Object.keys(PROVIDER_LABELS) as ProviderOption[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
                {p !== "auto" && data && !availableProviders.includes(p)
                  ? " — not configured"
                  : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
          {error}
        </p>
      )}

      {loading && !data ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Analyzing history…</p>
      ) : !forecast ? null : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Signal · {forecast.daysCovered} day{forecast.daysCovered === 1 ? "" : "s"} of
              history · confidence: {forecast.confidence}
            </h3>

            {forecast.trend ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  Trend:{" "}
                  <span className="font-semibold">
                    {forecast.trend.direction === "up"
                      ? "Rising"
                      : forecast.trend.direction === "down"
                        ? "Falling"
                        : "Flat"}
                  </span>{" "}
                  <span className="rate-num">
                    ({forecast.trend.pctChangePerDay > 0 ? "+" : ""}
                    {forecast.trend.pctChangePerDay}%/day)
                  </span>
                </p>
                <p>
                  Projected next-day TT Buying{" "}
                  <span className="rate-num font-semibold">
                    {formatRate(forecast.trend.projectedNextDayBuying, currency)}
                  </span>
                </p>
                <p>
                  Projected next-day TT Selling{" "}
                  <span className="rate-num font-semibold">
                    {formatRate(forecast.trend.projectedNextDaySelling, currency)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
                Not enough history yet for a trend — check back after a few more days of
                collection.
              </p>
            )}

            {forecast.bestDayOfWeek && (
              <div className="mt-4 border-t border-[var(--color-line)] pt-3 text-sm">
                <p>
                  Best day (avg TT Buying):{" "}
                  <span className="font-semibold">
                    {weekdayName(forecast.bestDayOfWeek.weekday)}
                  </span>{" "}
                  <span className="rate-num">
                    {formatRate(forecast.bestDayOfWeek.avgBuying, currency)}
                  </span>
                </p>
                {forecast.worstDayOfWeek && (
                  <p className="text-[var(--color-ink-muted)]">
                    Worst day: {weekdayName(forecast.worstDayOfWeek.weekday)}{" "}
                    <span className="rate-num">
                      {formatRate(forecast.worstDayOfWeek.avgBuying, currency)}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
              AI summary
              <span className="ml-2 font-normal normal-case text-[var(--color-ink-muted)]">
                (
                {data?.narrationSource === "gemini"
                  ? "Gemini"
                  : data?.narrationSource === "groq"
                    ? "Groq"
                    : "auto-generated"}
                )
              </span>
            </h3>
            <p className="mt-3 text-sm leading-relaxed">{data?.narration}</p>
            <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
              Indicative only, derived from statistics above — not financial advice.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
