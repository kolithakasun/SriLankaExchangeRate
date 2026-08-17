import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getEnabledBanks } from "@shared/config/banks";
import { getEnabledCurrencies } from "@shared/config/currencies";
import { DEFAULT_RANGE, historyRanges } from "@shared/config/ranges";
import { formatRate } from "@shared/utils/rates";
import { colomboDateKey, toColomboTime } from "@shared/utils/time";
import { fetchHistory, type HistoryResponse } from "../services/api";
import type { HistoryRange } from "@shared/types";

function formatSigned(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value}`;
}

function changeClass(value: number | null): string {
  if (value === null || value === 0) return "text-[var(--color-ink-muted)]";
  return value > 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]";
}

export function HistorySection({ defaultCurrency }: { defaultCurrency: string }) {
  const banks = getEnabledBanks();
  const currencies = getEnabledCurrencies();
  const [bank, setBank] = useState<string>(banks[0]?.code ?? "SEYLAN");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [range, setRange] = useState<HistoryRange>(DEFAULT_RANGE);
  const [date, setDate] = useState(colomboDateKey());
  const [dates, setDates] = useState<string[]>([colomboDateKey()]);
  const [data, setData] = useState<HistoryResponse | null>(null);
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
        const res = await fetchHistory({
          bank,
          currency,
          range,
          ...(range === "1d" ? { date } : {}),
        });
        if (cancelled) return;
        setData(res);
        if (res.availableDates.length) setDates(res.availableDates);
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
  }, [bank, currency, range, date]);

  const isIntraday = range === "1d";
  const points = data?.points ?? [];
  const daily = data?.daily ?? [];
  const summary = data?.summary ?? null;

  const chartData = useMemo(() => {
    if (isIntraday) {
      return points.map((p) => ({
        label: toColomboTime(p.retrievedAt),
        buying: p.ttBuying,
        selling: p.ttSelling,
      }));
    }
    return daily.map((d) => ({
      label: d.date.slice(5),
      buying: d.ttBuying,
      selling: d.ttSelling,
    }));
  }, [isIntraday, points, daily]);

  /** Daily rows newest first, with the day-over-day move already computed. */
  const dailyRows = useMemo(
    () =>
      daily
        .map((day, index) => {
          const prev = index > 0 ? daily[index - 1] : null;
          const diff = (a: number | null, b: number | null) =>
            a === null || b === null ? null : Number((a - b).toFixed(4));
          return {
            ...day,
            buyingChange: diff(day.ttBuying, prev?.ttBuying ?? null),
            sellingChange: diff(day.ttSelling, prev?.ttSelling ?? null),
          };
        })
        .reverse(),
    [daily],
  );

  const hasData = isIntraday ? points.length > 0 : daily.length > 0;
  const activeRange = historyRanges.find((r) => r.value === range);

  return (
    <section id="history" className="scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">History</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {isIntraday
              ? "Intraday TT observations for a bank and currency"
              : `Daily TT rates · ${activeRange?.description ?? ""}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="History range">
          {historyRanges.map((r) => {
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

      <div className={`mb-4 grid gap-3 ${isIntraday ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
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
        {isIntraday && (
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-muted)]">Date</span>
            <select
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            >
              {[...new Set([date, ...dates])]
                .sort((a, b) => (a < b ? 1 : -1))
                .map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
          {error}
        </p>
      )}

      {!isIntraday && summary && summary.days > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Days with data", value: String(summary.days) },
            {
              label: "Highest TT buying",
              value: formatRate(summary.highBuying, currency),
            },
            {
              label: "Lowest TT buying",
              value: formatRate(summary.lowBuying, currency),
            },
            {
              label: "Net change (buying)",
              value: formatSigned(summary.netBuyingChange),
              tone: changeClass(summary.netBuyingChange),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                {item.label}
              </p>
              <p className={`rate-num mt-1 text-lg font-bold ${item.tone ?? ""}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading history…</p>
      ) : !hasData ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          {isIntraday
            ? "No observations for this date. Refresh rates to start collecting history."
            : "No history stored for this range yet. One record per day is saved from the first successful check of each day."}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="max-h-96 overflow-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-[var(--color-line)] bg-[var(--color-panel)] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-4 py-3">{isIntraday ? "Time" : "Date"}</th>
                  <th className="px-4 py-3">TT Buying</th>
                  <th className="px-4 py-3">TT Selling</th>
                  {!isIntraday && <th className="px-4 py-3">Change</th>}
                  {!isIntraday && <th className="px-4 py-3">Updates</th>}
                </tr>
              </thead>
              <tbody>
                {isIntraday
                  ? points.map((p) => (
                      <tr
                        key={p.id ?? p.retrievedAt}
                        className="border-b border-[var(--color-line)] last:border-0"
                      >
                        <td className="px-4 py-2.5">{toColomboTime(p.retrievedAt)}</td>
                        <td className="rate-num px-4 py-2.5 font-semibold">
                          {formatRate(p.ttBuying, currency)}
                        </td>
                        <td className="rate-num px-4 py-2.5 font-semibold">
                          {formatRate(p.ttSelling, currency)}
                        </td>
                      </tr>
                    ))
                  : dailyRows.map((d) => (
                      <tr
                        key={d.date}
                        className="border-b border-[var(--color-line)] last:border-0"
                      >
                        <td className="px-4 py-2.5">{d.date}</td>
                        <td className="rate-num px-4 py-2.5 font-semibold">
                          {formatRate(d.ttBuying, currency)}
                        </td>
                        <td className="rate-num px-4 py-2.5 font-semibold">
                          {formatRate(d.ttSelling, currency)}
                        </td>
                        <td
                          className={`rate-num px-4 py-2.5 font-semibold ${changeClass(d.buyingChange)}`}
                        >
                          {formatSigned(d.buyingChange)}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-ink-muted)]">
                          {d.changeCount}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          <div className="h-96 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  minTickGap={16}
                  interval="preserveStartEnd"
                />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} width={56} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="buying"
                  name="TT Buying"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={chartData.length <= 40}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="selling"
                  name="TT Selling"
                  stroke="#2f6fed"
                  strokeWidth={2}
                  dot={chartData.length <= 40}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!isIntraday && data?.dailySource === "observations" && daily.length > 0 && (
        <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
          Daily series derived from stored observations. Apply
          <code className="mx-1">supabase/migrations/002_daily_rates.sql</code>
          to use the daily snapshot table.
        </p>
      )}
    </section>
  );
}
