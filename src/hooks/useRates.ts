import { useCallback, useEffect, useState } from "react";
import { fetchRates, refreshRates, type RatesResponse } from "../services/api";

const RATE_AUTO_REFRESH_MS = 30 * 60 * 1000;

export function useRates(currency: string) {
  const [data, setData] = useState<RatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRates(currency);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), RATE_AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshRates();
      const res = await fetchRates(currency);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [currency]);

  return { data, loading, refreshing, error, reload: load, refresh };
}
