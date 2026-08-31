import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getEnabledBanks } from "@shared/config/banks";
import { getEnabledCurrencies } from "@shared/config/currencies";
import {
  DEFAULT_FORECAST_RANGE,
  forecastRanges,
  getForecastRange,
} from "@shared/config/ranges";
import { formatRate } from "@shared/utils/rates";
import { weekdayName } from "@shared/utils/forecast";
import { relativeTime, toColombo } from "@shared/utils/time";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchCursorForecastStatus,
  fetchForecast,
  refreshForecast,
  type AiProviderOption,
  type CursorQuota,
  type ForecastResponse,
} from "../services/api";
import type {
  ForecastResult,
  ForecastRange,
  ForecastReferences,
  ReferenceSeriesView,
} from "@shared/types";

const FORECAST_AUTO_REFRESH_MS = 6 * 60 * 60 * 1000;
const CURSOR_POLL_MS = 5_000;

const PROVIDER_LABELS: Record<AiProviderOption, string> = {
  auto: "Auto (best available)",
  gemini: "Gemini",
  groq: "Groq",
  cursor: "Cursor (signed-in, 2/day)",
};

export function ForecastPanel({
  defaultCurrency,
  refreshKey,
}: {
  defaultCurrency: string;
  refreshKey?: string | null;
}) {
  const { session, accessToken } = useAuth();
  const banks = getEnabledBanks();
  const currencies = getEnabledCurrencies();
  const [bank, setBank] = useState<string>(banks[0]?.code ?? "SEYLAN");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [provider, setProvider] = useState<AiProviderOption>("auto");
  const [range, setRange] = useState<ForecastRange>(DEFAULT_FORECAST_RANGE);
  const [includeReferences, setIncludeReferences] = useState(true);
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [quota, setQuota] = useState<CursorQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const pendingRunId = useRef<string | null>(null);

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    if (provider === "cursor" && !session) {
      setProvider("auto");
    }
  }, [provider, session]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      // Auto-refresh never launches Cursor; when Cursor is selected the GET
      // path may still return the last saved Cursor summary if quota is exhausted.
      const res = await fetchForecast({
        bank,
        currency,
        range,
        provider,
        references: includeReferences,
        accessToken,
      });
      if (requestId.current === id) {
        setData(res);
        if (res.cursorQuota) setQuota(res.cursorQuota);
      }
    } catch (err) {
      if (requestId.current === id) {
        setError(err instanceof Error ? err.message : String(err));
        setData(null);
      }
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [bank, currency, range, provider, includeReferences, accessToken]);

  const updateNow = useCallback(async () => {
    const id = ++requestId.current;
    setUpdating(true);
    setError(null);
    try {
      const res = await refreshForecast({
        bank,
        currency,
        range,
        provider,
        references: includeReferences,
        accessToken,
      });
      if (requestId.current !== id) return;
      setData(res);
      if (res.cursorQuota) setQuota(res.cursorQuota);
      if (res.cursorPending && res.cursorRun?.id) {
        pendingRunId.current = res.cursorRun.id;
      } else {
        pendingRunId.current = null;
      }
    } catch (err) {
      if (requestId.current === id) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (requestId.current === id) setUpdating(false);
    }
  }, [bank, currency, range, provider, includeReferences, accessToken]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), FORECAST_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, refreshKey]);

  useEffect(() => {
    if (!accessToken) {
      setQuota(null);
      return;
    }
    let cancelled = false;
    void fetchCursorForecastStatus({ accessToken })
      .then((res) => {
        if (!cancelled) setQuota(res.cursorQuota);
      })
      .catch(() => {
        /* quota is optional until migration is applied */
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !pendingRunId.current) return;
    const runId = pendingRunId.current;
    const timer = window.setInterval(() => {
      void fetchCursorForecastStatus({ accessToken, runId })
        .then((res) => {
          if (res.cursorQuota) setQuota(res.cursorQuota);
          const status = res.cursorRun?.status;
          if (status === "completed" && res.cursorRun?.narration) {
            pendingRunId.current = null;
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    narration: res.cursorRun!.narration!,
                    narrationSource: "cursor",
                    narrationCached: false,
                    cursorPending: false,
                    cursorRun: res.cursorRun,
                    cursorQuota: res.cursorQuota,
                  }
                : prev,
            );
          } else if (status === "failed" || status === "released") {
            pendingRunId.current = null;
            setError(res.cursorRun?.error ?? "Cursor generation failed");
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    cursorPending: false,
                    cursorRun: res.cursorRun,
                    cursorQuota: res.cursorQuota,
                  }
                : prev,
            );
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        });
    }, CURSOR_POLL_MS);
    return () => window.clearInterval(timer);
  }, [accessToken, data?.cursorPending]);

  const availableProviders = data?.availableProviders ?? [];
  const providerOptions = useMemo(() => {
    const base: AiProviderOption[] = ["auto", "gemini", "groq"];
    if (session) base.push("cursor");
    return base;
  }, [session]);

  const forecast = data?.forecast;
  const activeRange = getForecastRange(data?.range ?? range);
  const cursorBusy = Boolean(data?.cursorPending);

  return (
    <section id="forecast" className="scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Forecast</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Bank, CBSL, and Google daily history from the database
            {activeRange ? ` · ${activeRange.description}` : ""}
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            {data?.generatedAt
              ? `Computed ${relativeTime(data.generatedAt)} · ${toColombo(data.generatedAt)}`
              : loading
                ? "Analyzing history…"
                : "Not computed yet"}
          </p>
          {session && quota && (
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Cursor quota today (Colombo): {quota.used}/{quota.limit}
              {quota.remaining === 0
                ? ` · exhausted until ${toColombo(quota.resetAt)}`
                : ` · ${quota.remaining} remaining`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!session && (
            <Link
              to="/login"
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm font-semibold"
            >
              Sign in for Cursor
            </Link>
          )}
          <button
            type="button"
            onClick={() => void updateNow()}
            disabled={updating || loading || cursorBusy}
            title={
              provider === "cursor"
                ? "Re-collect sources and spend at most one Cursor credit (max 2/day globally)"
                : "Re-collect all sources, re-pull CBSL history, and recompute now"
            }
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-60"
          >
            {cursorBusy
              ? "Cursor running…"
              : updating
                ? "Updating…"
                : "Update forecast"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex justify-end">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Forecast range">
          {forecastRanges.map((r) => {
            const active = r.value === range;
            return (
              <button
                key={r.value}
                type="button"
                role="tab"
                aria-selected={active}
                title={r.description}
                onClick={() => setRange(r.value)}
                className={`min-w-12 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : "border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-ink)] hover:border-[var(--color-accent)]"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            onChange={(e) => setProvider(e.target.value as AiProviderOption)}
          >
            {providerOptions.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
                {p !== "auto" &&
                p !== "cursor" &&
                data &&
                !availableProviders.includes(p)
                  ? " — not configured"
                  : ""}
                {p === "cursor" &&
                data &&
                !availableProviders.includes("cursor")
                  ? " — not configured"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end text-sm">
          <span className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={includeReferences}
              onChange={(e) => setIncludeReferences(e.target.checked)}
            />
            <span>CBSL + Google signal</span>
          </span>
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
              Signal · {activeRange?.label ?? "1M"} · {forecast.daysCovered} day
              {forecast.daysCovered === 1 ? "" : "s"} of history · confidence:{" "}
              {forecast.confidence}
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
                    : data?.narrationSource === "cursor"
                      ? data.cursorQuotaExhausted
                        ? "Cursor · last saved"
                        : data.narrationCached
                          ? "Cursor · cached"
                          : data.cursorPending
                            ? "Cursor · pending"
                            : "Cursor"
                      : "auto-generated"}
                )
              </span>
            </h3>
            <p className="mt-3 text-sm leading-relaxed">{data?.narration}</p>
            {data?.cursorQuotaExhausted && (
              <p className="mt-2 text-xs text-[var(--color-warn)]">
                Daily Cursor limit reached — showing the last generated Cursor
                summary with the latest forecast numbers.
              </p>
            )}
            <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
              Indicative only, derived from statistics above — not financial advice.
              Cursor runs only when you click Update with Cursor selected (max 2/day
              globally).
            </p>
          </div>

          {forecast.assumptions && (
            <ForecastAssumptionsCard
              assumptions={forecast.assumptions}
              currency={currency}
            />
          )}

          {includeReferences && forecast.references && (
            <ReferenceSignalsCard
              references={forecast.references}
              currency={currency}
            />
          )}
        </div>
      )}
    </section>
  );
}

function ForecastAssumptionsCard({
  assumptions,
  currency,
}: {
  assumptions: NonNullable<ForecastResult["assumptions"]>;
  currency: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Longer-term TT buying assumptions
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            All stored bank history + {assumptions.cbslDaysCovered} CBSL days (
            {assumptions.cbslFirstDate}–{assumptions.cbslLastDate})
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)]">
          Recomputed every 6 h while this page is open
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {assumptions.horizons.map((item) => (
          <div
            key={item.horizonDays}
            className="rounded-xl border border-[var(--color-line)] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Next {item.label}
            </p>
            <p className="rate-num mt-2 text-xl font-extrabold">
              {formatRate(item.projectedBuying, currency)}
            </p>
            <p
              className={`mt-1 text-xs font-semibold ${
                item.change < 0
                  ? "text-[var(--color-down)]"
                  : "text-[var(--color-up)]"
              }`}
            >
              {item.change > 0 ? "+" : ""}
              {formatRate(item.change, currency)} ({item.changePct > 0 ? "+" : ""}
              {item.changePct}%)
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--color-ink-muted)]">
        Central assumptions use a calendar-day trend with a{" "}
        {assumptions.halfLifeDays}-day half-life:{" "}
        {Math.round(assumptions.cbslWeight * 100)}% CBSL and{" "}
        {Math.round(assumptions.bankWeight * 100)}% selected-bank behavior. Every
        historical CBSL point is included, but older exchange-rate regimes carry
        progressively less weight. Indicative only; these are not forward quotes.
      </p>
    </div>
  );
}

function trendLabel(view: ReferenceSeriesView): string {
  if (!view.trend) return "Not enough history for a trend";
  const direction =
    view.trend.direction === "up"
      ? "Rising"
      : view.trend.direction === "down"
        ? "Falling"
        : "Flat";
  return `${direction} (${view.trend.pctChangePerDay > 0 ? "+" : ""}${view.trend.pctChangePerDay}%/day)`;
}

function signed(value: number | null, currency: string): string {
  if (value === null) return "—";
  const formatted = formatRate(Math.abs(value), currency);
  if (value === 0) return formatted;
  return `${value > 0 ? "+" : "−"}${formatted}`;
}

function ReferenceSignalsCard({
  references,
  currency,
}: {
  references: ForecastReferences;
  currency: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 lg:col-span-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
        CBSL + Google signal
      </h3>
      <p className="mt-2 text-sm leading-relaxed">{references.combinedSignal}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="text-sm">
          <p className="font-semibold">CBSL official TT (9:30 a.m. average)</p>
          {references.cbsl ? (
            <div className="mt-1 space-y-1">
              <p>
                Latest {references.cbsl.latestDate ?? "—"} · buy{" "}
                <span className="rate-num font-semibold">
                  {formatRate(references.cbsl.latestBuying, currency)}
                </span>{" "}
                · sell{" "}
                <span className="rate-num font-semibold">
                  {formatRate(references.cbsl.latestSelling, currency)}
                </span>
              </p>
              <p className="text-[var(--color-ink-muted)]">
                {trendLabel(references.cbsl)} · {references.cbsl.daysCovered} days
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[var(--color-ink-muted)]">
              {references.errors.CBSL ?? "Not available"}
            </p>
          )}
        </div>
        <div className="text-sm">
          <p className="font-semibold">Google Finance mid</p>
          {references.google ? (
            <div className="mt-1 space-y-1">
              <p>
                Latest {references.google.latestDate ?? "—"} · mid{" "}
                <span className="rate-num font-semibold">
                  {formatRate(references.google.latestBuying, currency)}
                </span>
              </p>
              <p className="text-[var(--color-ink-muted)]">
                {trendLabel(references.google)} · {references.google.daysCovered} days
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[var(--color-ink-muted)]">
              {references.errors.GOOGLE ?? "Not available"}
            </p>
          )}
        </div>
      </div>

      {references.comparisons.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-3 text-sm">
          {references.comparisons.map((c) => (
            <p key={c.source}>
              vs {c.label}: buying {signed(c.buyingSpread, currency)}, selling{" "}
              {signed(c.sellingSpread, currency)}
              {c.alignment !== "unknown" ? ` · trend ${c.alignment}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
