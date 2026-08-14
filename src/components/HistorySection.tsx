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
import { formatRate } from "@shared/utils/rates";
import { colomboDateKey, toColomboTime } from "@shared/utils/time";
import { fetchHistory } from "../services/api";
import type { HistoryPoint } from "@shared/types";

export function HistorySection({
  defaultCurrency,
}: {
  defaultCurrency: string;
}) {
  const banks = getEnabledBanks();
  const currencies = getEnabledCurrencies();
  const [bank, setBank] = useState<string>(banks[0]?.code ?? "SEYLAN");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [date, setDate] = useState(colomboDateKey());
  const [dates, setDates] = useState<string[]>([colomboDateKey()]);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
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
        const res = await fetchHistory({ bank, currency, date });
        if (cancelled) return;
        setPoints(res.points);
        setDates(res.availableDates.length ? res.availableDates : [date]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setPoints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bank, currency, date]);

  const chartData = useMemo(
    () =>
      points.map((p) => ({
        time: toColomboTime(p.retrievedAt),
        buying: p.ttBuying,
        selling: p.ttSelling,
      })),
    [points],
  );

  return (
    <section id="history" className="scroll-mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">History</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Intraday TT observations for a bank and currency
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
          <span className="mb-1 block text-[var(--color-ink-muted)]">Date</span>
          <select
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          >
            {[...new Set([date, ...dates])].sort((a, b) => (a < b ? 1 : -1)).map((d) => (
              <option key={d} value={d}>
                {d}
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

      {loading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading history…</p>
      ) : points.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          No observations for this selection yet. Refresh rates to start collecting history.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-line)] text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">TT Buying</th>
                  <th className="px-4 py-3">TT Selling</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.id ?? p.retrievedAt} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-2.5">{toColomboTime(p.retrievedAt)}</td>
                    <td className="rate-num px-4 py-2.5 font-semibold">
                      {formatRate(p.ttBuying, currency)}
                    </td>
                    <td className="rate-num px-4 py-2.5 font-semibold">
                      {formatRate(p.ttSelling, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-72 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 12 }}
                  width={56}
                />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="buying"
                  name="TT Buying"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="selling"
                  name="TT Selling"
                  stroke="#2f6fed"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
